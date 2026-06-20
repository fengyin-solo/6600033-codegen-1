import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

const STORAGE_KEYS = {
  PLANS: 'mc_experiment_plans',
  CURRENT_PLAN_ID: 'mc_current_plan_id',
  BATCH_RESULTS: 'mc_batch_results',
  BATCH_COUNT: 'mc_batch_count'
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return defaultValue
    return JSON.parse(raw) as T
  } catch (e) {
    console.warn(`Failed to load ${key} from localStorage:`, e)
    return defaultValue
  }
}

function saveToStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn(`Failed to save ${key} to localStorage:`, e)
  }
}

export interface MCScenario {
  id: string
  name: string
  description: string
  params: Record<string, number>
  category: string
}

export interface MCResult {
  scenario: string
  iterations: number
  estimate: number
  trueValue?: number
  error?: number
  samples: number[]
  convergence: number[]
}

export interface HypTestResult {
  testType: string
  statistic: number
  pValue: number
  significant: boolean
  alpha: number
  df?: number
}

export interface ExperimentStep {
  id: string
  scenarioId: string
  iterations: number
  params: Record<string, number>
  order: number
}

export interface ExperimentPlan {
  id: string
  name: string
  description: string
  steps: ExperimentStep[]
  createdAt: number
  updatedAt: number
}

export interface BatchResult {
  batchId: string
  batchName: string
  stepId: string
  scenarioId: string
  scenarioName: string
  result: MCResult
  runAt: number
  duration: number
}

export interface ExperimentConclusion {
  bestScenario: string
  averageEstimate: number
  totalRuns: number
  summary: string
  details: Record<string, { avg: number; min: number; max: number; std: number }>
}

export interface ExperimentState {
  plans: ExperimentPlan[]
  currentPlan: ExperimentPlan | null
  batchResults: BatchResult[]
  isBatchRunning: boolean
  currentBatchIndex: number
  batchCount: number
}

function normalRandom(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function runMC(scenario: MCScenario, n: number): MCResult {
  const samples: number[] = []
  const convergence: number[] = []

  if (scenario.id === 'pi') {
    let inside = 0
    for (let i = 0; i < n; i++) {
      const x = Math.random() * 2 - 1, y = Math.random() * 2 - 1
      if (x * x + y * y <= 1) inside++
      samples.push(x * x + y * y <= 1 ? 1 : 0)
      convergence.push((inside / (i + 1)) * 4)
    }
    const estimate = (inside / n) * 4
    return { scenario: 'pi', iterations: n, estimate, trueValue: Math.PI, error: Math.abs(estimate - Math.PI), samples, convergence }
  }
  if (scenario.id === 'brownian') {
    let pos = 0
    const dt = scenario.params.dt || 0.01
    for (let i = 0; i < n; i++) { pos += normalRandom() * Math.sqrt(dt); samples.push(pos) }
    convergence.push(...samples.slice(0, 200))
    return { scenario: 'brownian', iterations: n, estimate: pos, samples, convergence }
  }
  if (scenario.id === 'option') {
    const { S0 = 100, K = 105, r = 0.05, sigma = 0.2, T = 1 } = scenario.params
    let payoffSum = 0
    for (let i = 0; i < n; i++) {
      const ST = S0 * Math.exp((r - 0.5 * sigma * sigma) * T + sigma * Math.sqrt(T) * normalRandom())
      const p = Math.max(ST - K, 0); payoffSum += p; samples.push(p)
      if ((i + 1) % 50 === 0) convergence.push((payoffSum / (i + 1)) * Math.exp(-r * T))
    }
    return { scenario: 'option', iterations: n, estimate: (payoffSum / n) * Math.exp(-r * T), samples, convergence }
  }
  if (scenario.id === 'random_walk') {
    let pos = 0
    for (let i = 0; i < n; i++) { pos += Math.random() > 0.5 ? 1 : -1; samples.push(pos) }
    convergence.push(...samples.slice(0, 200))
    return { scenario: 'random_walk', iterations: n, estimate: pos, samples, convergence }
  }
  if (scenario.id === 'diffusion') {
    const { D = 1, dt = 0.01 } = scenario.params
    let x = 0, y = 0
    for (let i = 0; i < n; i++) {
      x += normalRandom() * Math.sqrt(2 * D * dt); y += normalRandom() * Math.sqrt(2 * D * dt)
      samples.push(Math.sqrt(x * x + y * y))
    }
    convergence.push(...samples.slice(0, 200))
    return { scenario: 'diffusion', iterations: n, estimate: Math.sqrt(x * x + y * y), samples, convergence }
  }
  // gambler
  const { p = 0.45, bankroll = 50, goal = 100 } = scenario.params
  let ruinCount = 0
  for (let i = 0; i < n; i++) {
    let money = bankroll
    let steps = 0
    while (money > 0 && money < goal && steps < 10000) { money += Math.random() < p ? 1 : -1; steps++ }
    if (money <= 0) ruinCount++
    samples.push(money <= 0 ? 0 : 1)
    convergence.push(ruinCount / (i + 1))
  }
  return { scenario: 'gambler', iterations: n, estimate: ruinCount / n, samples, convergence }
}

export const SCENARIOS: MCScenario[] = [
  { id: 'pi', name: '圆周率π估算', description: '随机投点估算π值，观察收敛过程', params: {}, category: '基础' },
  { id: 'brownian', name: '布朗运动模拟', description: '粒子热运动随机路径模拟', params: { dt: 0.01 }, category: '物理' },
  { id: 'option', name: '欧式期权定价', description: 'Black-Scholes期权价格蒙特卡洛估算', params: { S0: 100, K: 105, r: 0.05, sigma: 0.2, T: 1 }, category: '金融' },
  { id: 'random_walk', name: '随机游走', description: '一维离散随机游走轨迹模拟', params: {}, category: '基础' },
  { id: 'diffusion', name: '粒子扩散', description: '二维粒子随机扩散位移分析', params: { D: 1, dt: 0.01 }, category: '物理' },
  { id: 'gambler', name: '赌徒破产', description: '不利赌局下资金耗尽概率估算', params: { p: 0.45, bankroll: 50, goal: 100 }, category: '概率' }
]

function genId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
}

function calcStats(values: number[]): { avg: number; min: number; max: number; std: number } {
  if (values.length === 0) return { avg: 0, min: 0, max: 0, std: 0 }
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length
  return { avg, min: Math.min(...values), max: Math.max(...values), std: Math.sqrt(variance) }
}

export const useMCStore = defineStore('mc', () => {
  const currentScenario = ref<MCScenario>(SCENARIOS[0])
  const iterations = ref(1000)
  const result = ref<MCResult | null>(null)
  const testResult = ref<HypTestResult | null>(null)
  const isRunning = ref(false)

  const savedPlans = loadFromStorage<ExperimentPlan[]>(STORAGE_KEYS.PLANS, [])
  const savedCurrentPlanId = loadFromStorage<string | null>(STORAGE_KEYS.CURRENT_PLAN_ID, null)
  const savedBatchResults = loadFromStorage<BatchResult[]>(STORAGE_KEYS.BATCH_RESULTS, [])
  const savedBatchCount = loadFromStorage<number>(STORAGE_KEYS.BATCH_COUNT, 3)

  const plans = ref<ExperimentPlan[]>(savedPlans)
  const currentPlan = ref<ExperimentPlan | null>(
    savedCurrentPlanId ? savedPlans.find(p => p.id === savedCurrentPlanId) || null : null
  )
  const batchResults = ref<BatchResult[]>(savedBatchResults)
  const isBatchRunning = ref(false)
  const currentBatchIndex = ref(0)
  const batchCount = ref(savedBatchCount)

  watch(plans, (val) => {
    saveToStorage(STORAGE_KEYS.PLANS, val)
  }, { deep: true })

  watch(currentPlan, (val) => {
    saveToStorage(STORAGE_KEYS.CURRENT_PLAN_ID, val?.id || null)
  }, { deep: true })

  watch(batchResults, (val) => {
    saveToStorage(STORAGE_KEYS.BATCH_RESULTS, val)
  }, { deep: true })

  watch(batchCount, (val) => {
    saveToStorage(STORAGE_KEYS.BATCH_COUNT, val)
  })

  function runSimulation() {
    isRunning.value = true
    setTimeout(() => { result.value = runMC(currentScenario.value, iterations.value); isRunning.value = false }, 10)
  }

  function createPlan(name: string, description: string): ExperimentPlan {
    const plan: ExperimentPlan = {
      id: genId(),
      name,
      description,
      steps: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    plans.value.push(plan)
    return plan
  }

  function setCurrentPlan(plan: ExperimentPlan | null) {
    currentPlan.value = plan
  }

  function addStep(planId: string, scenarioId: string, customIterations?: number, customParams?: Record<string, number>) {
    const plan = plans.value.find(p => p.id === planId)
    if (!plan) return
    const scenario = SCENARIOS.find(s => s.id === scenarioId)
    if (!scenario) return
    const step: ExperimentStep = {
      id: genId(),
      scenarioId,
      iterations: customIterations || iterations.value,
      params: customParams ? { ...scenario.params, ...customParams } : { ...scenario.params },
      order: plan.steps.length
    }
    plan.steps.push(step)
    plan.updatedAt = Date.now()
  }

  function removeStep(planId: string, stepId: string) {
    const plan = plans.value.find(p => p.id === planId)
    if (!plan) return
    plan.steps = plan.steps.filter(s => s.id !== stepId)
    plan.steps.forEach((s, i) => s.order = i)
    plan.updatedAt = Date.now()
  }

  function updateStep(planId: string, stepId: string, updates: Partial<ExperimentStep>) {
    const plan = plans.value.find(p => p.id === planId)
    if (!plan) return
    const step = plan.steps.find(s => s.id === stepId)
    if (!step) return
    Object.assign(step, updates)
    plan.updatedAt = Date.now()
  }

  function reorderStep(planId: string, stepId: string, newOrder: number) {
    const plan = plans.value.find(p => p.id === planId)
    if (!plan) return
    const stepIdx = plan.steps.findIndex(s => s.id === stepId)
    if (stepIdx === -1) return
    const [step] = plan.steps.splice(stepIdx, 1)
    plan.steps.splice(Math.max(0, Math.min(newOrder, plan.steps.length)), 0, step)
    plan.steps.forEach((s, i) => s.order = i)
    plan.updatedAt = Date.now()
  }

  function deletePlan(planId: string) {
    plans.value = plans.value.filter(p => p.id !== planId)
    if (currentPlan.value?.id === planId) currentPlan.value = null
  }

  async function runExperimentBatch(plan: ExperimentPlan, batches: number = 3): Promise<BatchResult[]> {
    isBatchRunning.value = true
    currentBatchIndex.value = 0
    batchCount.value = batches
    const results: BatchResult[] = []

    for (let b = 0; b < batches; b++) {
      currentBatchIndex.value = b
      for (const step of plan.steps) {
        const scenario = SCENARIOS.find(s => s.id === step.scenarioId)
        if (!scenario) continue

        const fullScenario: MCScenario = { ...scenario, params: step.params }
        const start = performance.now()
        const mcResult = runMC(fullScenario, step.iterations)
        const duration = performance.now() - start

        results.push({
          batchId: `batch_${b}`,
          batchName: `第${b + 1}批`,
          stepId: step.id,
          scenarioId: step.scenarioId,
          scenarioName: scenario.name,
          result: mcResult,
          runAt: Date.now(),
          duration
        })

        await new Promise(r => setTimeout(r, 50))
      }
    }

    batchResults.value = results
    isBatchRunning.value = false
    return results
  }

  function clearBatchResults() {
    batchResults.value = []
  }

  function getScenarioStats(scenarioId: string) {
    const estimates = batchResults.value
      .filter(r => r.scenarioId === scenarioId)
      .map(r => r.result.estimate)
    return calcStats(estimates)
  }

  const experimentConclusion = computed((): ExperimentConclusion | null => {
    if (batchResults.value.length === 0) return null

    const grouped = new Map<string, number[]>()
    batchResults.value.forEach(r => {
      if (!grouped.has(r.scenarioId)) grouped.set(r.scenarioId, [])
      grouped.get(r.scenarioId)!.push(r.result.estimate)
    })

    const details: Record<string, { avg: number; min: number; max: number; std: number }> = {}
    let bestScenario = ''
    let lowestError = Infinity

    grouped.forEach((estimates, sid) => {
      const stats = calcStats(estimates)
      details[sid] = stats
      const scenario = SCENARIOS.find(s => s.id === sid)
      if (scenario && 'trueValue' in batchResults.value.find(r => r.scenarioId === sid)!.result) {
        const trueVal = batchResults.value.find(r => r.scenarioId === sid)!.result.trueValue!
        const err = Math.abs(stats.avg - trueVal)
        if (err < lowestError) {
          lowestError = err
          bestScenario = scenario.name
        }
      }
    })

    const allEstimates = batchResults.value.map(r => r.result.estimate)
    const avgEstimate = allEstimates.reduce((a, b) => a + b, 0) / allEstimates.length
    const uniqueScenarios = new Set(batchResults.value.map(r => r.scenarioName))

    return {
      bestScenario: bestScenario || Array.from(uniqueScenarios)[0],
      averageEstimate: avgEstimate,
      totalRuns: batchResults.value.length,
      summary: `共执行 ${batchResults.value.length} 次模拟，涉及 ${uniqueScenarios.size} 种场景，平均估算值 ${avgEstimate.toFixed(6)}`,
      details
    }
  })

  const groupedBatchResults = computed(() => {
    const groups = new Map<string, BatchResult[]>()
    batchResults.value.forEach(r => {
      const key = r.batchId
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    })
    return Array.from(groups.entries()).map(([batchId, results]) => ({ batchId, batchName: results[0]?.batchName || batchId, results }))
  })

  const scenarioComparisonData = computed(() => {
    const scenarioIds = Array.from(new Set(batchResults.value.map(r => r.scenarioId)))
    return scenarioIds.map(sid => {
      const scenario = SCENARIOS.find(s => s.id === sid)
      const results = batchResults.value.filter(r => r.scenarioId === sid)
      const stats = getScenarioStats(sid)
      return {
        scenarioId: sid,
        scenarioName: scenario?.name || sid,
        runCount: results.length,
        ...stats,
        estimates: results.map(r => r.result.estimate)
      }
    })
  })

  function runTest(g1: number[], g2: number[]) {
    const n1 = g1.length, n2 = g2.length
    const m1 = g1.reduce((a, b) => a + b, 0) / n1
    const m2 = g2.reduce((a, b) => a + b, 0) / n2
    const v1 = g1.reduce((s, x) => s + (x - m1) ** 2, 0) / (n1 - 1)
    const v2 = g2.reduce((s, x) => s + (x - m2) ** 2, 0) / (n2 - 1)
    const se = Math.sqrt(v1 / n1 + v2 / n2)
    const t = (m1 - m2) / se
    const df = Math.round((v1 / n1 + v2 / n2) ** 2 / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1)))
    const pValue = 2 * (1 - Math.min(0.9999, Math.abs(t) / (Math.abs(t) + Math.sqrt(df))))
    testResult.value = { testType: 'Welch T检验', statistic: Math.round(t * 1000) / 1000, pValue: Math.round(pValue * 10000) / 10000, significant: pValue < 0.05, alpha: 0.05, df }
  }

  function setScenario(s: MCScenario) { currentScenario.value = s; result.value = null }

  const convergenceData = computed(() => {
    if (!result.value) return [] as [number, number][]
    return result.value.convergence.slice(0, 200).map((v, i): [number, number] => [i, Math.round(v * 100000) / 100000])
  })

  const histogramData = computed(() => {
    if (!result.value) return { xAxis: [] as number[], data: [] as number[] }
    const s = result.value.samples.slice(0, 1000)
    const mn = Math.min(...s), mx = Math.max(...s)
    const bins = 20, bs = (mx - mn) / bins || 1
    const counts = new Array(bins).fill(0)
    s.forEach(v => { counts[Math.min(bins - 1, Math.floor((v - mn) / bs))]++ })
    return { xAxis: Array.from({ length: bins }, (_, i) => Math.round((mn + i * bs) * 100) / 100), data: counts }
  })

  return {
    currentScenario, iterations, result, testResult, isRunning,
    plans, currentPlan, batchResults, isBatchRunning, currentBatchIndex, batchCount,
    experimentConclusion, groupedBatchResults, scenarioComparisonData,
    convergenceData, histogramData,
    runSimulation, runTest, setScenario,
    createPlan, setCurrentPlan, addStep, removeStep, updateStep, reorderStep, deletePlan,
    runExperimentBatch, clearBatchResults, getScenarioStats
  }
})
