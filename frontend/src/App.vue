<template>
  <div class="min-h-screen bg-slate-900 text-slate-200">
    <header class="border-b border-slate-700 px-6 py-4">
      <h1 class="text-2xl font-bold text-cyan-400">蒙特卡洛模拟与统计假设检验平台</h1>
      <p class="text-sm text-slate-500 mt-1">随机采样模拟 · 6种MC场景 · 假设检验 · 实验编排 · 多批次对比</p>
      <div class="flex gap-2 mt-4">
        <button @click="activeTab = 'simulation'" :class="['px-4 py-2 rounded text-sm font-bold transition-all', activeTab === 'simulation' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700']">单场景模拟</button>
        <button @click="activeTab = 'experiment'" :class="['px-4 py-2 rounded text-sm font-bold transition-all', activeTab === 'experiment' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700']">实验方案编排中心</button>
      </div>
    </header>
    <div v-if="activeTab === 'simulation'" class="flex flex-col lg:flex-row gap-4 p-4">
      <div class="lg:w-1/4 space-y-4">
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">模拟场景</h3>
          <div class="space-y-1">
            <div v-for="s in SCENARIOS" :key="s.id" @click="store.setScenario(s)"
              :class="['cursor-pointer p-2 rounded border text-sm transition-all', store.currentScenario.id === s.id ? 'border-cyan-500 bg-cyan-900/30 text-cyan-400' : 'border-slate-700 text-slate-300 hover:border-slate-500']">
              <div class="font-bold">{{ s.name }}</div>
              <div class="text-xs text-slate-500 mt-0.5">{{ s.description }}</div>
            </div>
          </div>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">参数控制</h3>
          <label class="text-xs text-slate-500">迭代次数: {{ store.iterations }}</label>
          <input type="range" min="100" max="5000" step="100" v-model.number="store.iterations" class="w-full mt-1 mb-3 accent-cyan-500" />
          <button @click="store.runSimulation" :disabled="store.isRunning" class="w-full py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded text-sm font-bold">
            {{ store.isRunning ? '运行中...' : '▶ 开始模拟' }}
          </button>
        </div>
        <div v-if="store.result" class="bg-slate-800 rounded-lg p-4 border border-slate-700 text-sm">
          <h3 class="text-sm font-bold text-slate-400 mb-3">模拟结果</h3>
          <div class="space-y-2">
            <div class="flex justify-between"><span class="text-slate-500">估算值</span><span class="text-cyan-400 font-bold font-mono">{{ store.result.estimate.toFixed(6) }}</span></div>
            <div v-if="store.result.trueValue !== undefined" class="flex justify-between"><span class="text-slate-500">真实值</span><span class="text-green-400 font-mono">{{ store.result.trueValue.toFixed(6) }}</span></div>
            <div v-if="store.result.error !== undefined" class="flex justify-between"><span class="text-slate-500">误差</span><span class="text-orange-400 font-mono">{{ store.result.error.toFixed(6) }}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">样本数</span><span class="text-slate-300">{{ store.result.iterations }}</span></div>
          </div>
        </div>
      </div>
      <div class="lg:w-3/4 space-y-4">
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">收敛过程</h3>
          <div ref="convergenceRef" class="w-full rounded" style="height:240px;background:#0f172a;"></div>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">样本分布直方图</h3>
          <div ref="histogramRef" class="w-full rounded" style="height:220px;background:#0f172a;"></div>
        </div>
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">假设检验 (独立样本 T 检验)</h3>
          <div class="grid grid-cols-2 gap-4 mb-3">
            <div>
              <label class="text-xs text-slate-500">样本组A (逗号分隔)</label>
              <textarea v-model="group1Input" rows="2" class="w-full mt-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-cyan-500 resize-none"></textarea>
            </div>
            <div>
              <label class="text-xs text-slate-500">样本组B (逗号分隔)</label>
              <textarea v-model="group2Input" rows="2" class="w-full mt-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-cyan-500 resize-none"></textarea>
            </div>
          </div>
          <button @click="runTest" class="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-sm">执行T检验</button>
          <div v-if="store.testResult" class="mt-3 grid grid-cols-4 gap-3 text-sm">
            <div class="bg-slate-900 rounded p-2 text-center"><div class="text-xs text-slate-500 mb-1">统计量 t</div><div class="text-cyan-400 font-bold font-mono">{{ store.testResult.statistic }}</div></div>
            <div class="bg-slate-900 rounded p-2 text-center"><div class="text-xs text-slate-500 mb-1">p 值</div><div class="font-bold font-mono" :class="store.testResult.significant ? 'text-red-400' : 'text-green-400'">{{ store.testResult.pValue }}</div></div>
            <div class="bg-slate-900 rounded p-2 text-center"><div class="text-xs text-slate-500 mb-1">自由度 df</div><div class="text-slate-300 font-mono">{{ store.testResult.df }}</div></div>
            <div class="bg-slate-900 rounded p-2 text-center"><div class="text-xs text-slate-500 mb-1">显著性</div><div class="text-xs font-bold" :class="store.testResult.significant ? 'text-red-400' : 'text-green-400'">{{ store.testResult.significant ? '显著(p<0.05)' : '不显著' }}</div></div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'experiment'" class="p-4">
      <div class="grid grid-cols-12 gap-4">
        <div class="col-span-12 lg:col-span-3 space-y-4">
          <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div class="flex justify-between items-center mb-3">
              <h3 class="text-sm font-bold text-slate-400">实验方案列表</h3>
              <button @click="showNewPlanModal = true" class="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-500 rounded">+ 新建</button>
            </div>
            <div class="space-y-2 max-h-64 overflow-y-auto">
              <div v-for="plan in store.plans" :key="plan.id" @click="selectPlan(plan)"
                :class="['cursor-pointer p-3 rounded border text-sm transition-all', store.currentPlan?.id === plan.id ? 'border-emerald-500 bg-emerald-900/30 text-emerald-400' : 'border-slate-700 text-slate-300 hover:border-slate-500']">
                <div class="font-bold flex justify-between">
                  <span>{{ plan.name }}</span>
                  <button @click.stop="deletePlan(plan.id)" class="text-xs text-red-400 hover:text-red-300">删除</button>
                </div>
                <div class="text-xs text-slate-500 mt-1">{{ plan.description || '无描述' }}</div>
                <div class="text-xs text-slate-500 mt-1">{{ plan.steps.length }} 个场景</div>
              </div>
              <div v-if="store.plans.length === 0" class="text-center text-slate-500 text-xs py-4">暂无实验方案</div>
            </div>
          </div>

          <div v-if="store.currentPlan" class="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h3 class="text-sm font-bold text-slate-400 mb-3">可添加场景</h3>
            <div class="space-y-1">
              <div v-for="s in SCENARIOS" :key="s.id" @click="addStepToPlan(s.id)"
                class="cursor-pointer p-2 rounded border border-slate-700 text-sm hover:border-emerald-500 hover:bg-emerald-900/20 transition-all">
                <div class="font-bold text-slate-300">{{ s.name }}</div>
                <div class="text-xs text-slate-500 mt-0.5">{{ s.category }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-span-12 lg:col-span-5 space-y-4">
          <div v-if="store.currentPlan" class="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div class="flex justify-between items-center mb-3">
              <div>
                <h3 class="text-sm font-bold text-emerald-400">{{ store.currentPlan.name }}</h3>
                <p class="text-xs text-slate-500">{{ store.currentPlan.description }}</p>
              </div>
              <div class="flex gap-2">
                <label class="text-xs text-slate-500 mr-2 self-center">批次: {{ batchCount }}</label>
                <input type="range" min="1" max="10" step="1" v-model.number="batchCount" class="w-24 accent-emerald-500 self-center" />
                <button @click="runExperiment" :disabled="store.isBatchRunning || store.currentPlan.steps.length === 0" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded text-sm font-bold">
                  {{ store.isBatchRunning ? `运行中 ${store.currentBatchIndex + 1}/${store.batchCount}` : '▶ 开始实验' }}
                </button>
              </div>
            </div>
            <div class="space-y-2">
              <div v-for="(step, idx) in store.currentPlan.steps" :key="step.id" class="bg-slate-900 rounded p-3 border border-slate-700">
                <div class="flex justify-between items-start">
                  <div class="flex items-center gap-2">
                    <span class="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">{{ idx + 1 }}</span>
                    <div>
                      <div class="font-bold text-slate-200">{{ getScenarioName(step.scenarioId) }}</div>
                      <div class="text-xs text-slate-500">迭代: {{ step.iterations }}</div>
                    </div>
                  </div>
                  <div class="flex gap-1">
                    <button @click="moveStep(step.id, -1)" :disabled="idx === 0" class="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-30">↑</button>
                    <button @click="moveStep(step.id, 1)" :disabled="idx === store.currentPlan!.steps.length - 1" class="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-30">↓</button>
                    <button @click="removeStep(step.id)" class="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 rounded">移除</button>
                  </div>
                </div>
                <div v-if="Object.keys(step.params).length > 0" class="mt-2 pt-2 border-t border-slate-700">
                  <div class="text-xs text-slate-500 mb-1">参数配置</div>
                  <div class="grid grid-cols-2 gap-2">
                    <div v-for="(val, key) in step.params" :key="key" class="flex items-center gap-1">
                      <label class="text-xs text-slate-400 w-16">{{ key }}</label>
                      <input type="number" :value="val" @input="updateStepParam(step.id, key, ($event.target as HTMLInputElement).valueAsNumber)" class="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-emerald-500" />
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="store.currentPlan.steps.length === 0" class="text-center text-slate-500 text-xs py-8">点击左侧场景添加到实验方案</div>
            </div>
          </div>

          <div v-else class="bg-slate-800 rounded-lg p-8 border border-slate-700 text-center">
            <div class="text-4xl mb-3">📋</div>
            <p class="text-slate-400">选择或创建一个实验方案开始编排</p>
            <button @click="showNewPlanModal = true" class="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-sm font-bold">+ 创建新方案</button>
          </div>

          <div v-if="store.experimentConclusion" class="bg-slate-800 rounded-lg p-4 border border-emerald-700">
            <h3 class="text-sm font-bold text-emerald-400 mb-3">实验结论</h3>
            <div class="bg-slate-900 rounded p-3 mb-3">
              <div class="text-sm text-slate-300">{{ store.experimentConclusion.summary }}</div>
              <div class="mt-2 flex justify-between text-xs">
                <span class="text-slate-500">最优场景</span>
                <span class="text-emerald-400 font-bold">{{ store.experimentConclusion.bestScenario }}</span>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div v-for="(stats, sid) in store.experimentConclusion.details" :key="sid" class="bg-slate-900 rounded p-2">
                <div class="font-bold text-slate-300 mb-1">{{ getScenarioName(sid as string) }}</div>
                <div class="flex justify-between"><span class="text-slate-500">均值</span><span class="text-cyan-400 font-mono">{{ stats.avg.toFixed(6) }}</span></div>
                <div class="flex justify-between"><span class="text-slate-500">标准差</span><span class="text-orange-400 font-mono">{{ stats.std.toFixed(6) }}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-span-12 lg:col-span-4 space-y-4">
          <div v-if="store.batchResults.length > 0" class="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div class="flex justify-between items-center mb-3">
              <h3 class="text-sm font-bold text-slate-400">结果对比</h3>
              <button @click="store.clearBatchResults" class="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 rounded">清空</button>
            </div>
            <div ref="comparisonChartRef" class="w-full rounded" style="height:220px;background:#0f172a;"></div>
          </div>

          <div v-if="store.scenarioComparisonData.length > 0" class="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h3 class="text-sm font-bold text-slate-400 mb-3">场景统计对比</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead>
                  <tr class="border-b border-slate-700">
                    <th class="text-left py-2 px-1 text-slate-500">场景</th>
                    <th class="text-right py-2 px-1 text-slate-500">次数</th>
                    <th class="text-right py-2 px-1 text-slate-500">均值</th>
                    <th class="text-right py-2 px-1 text-slate-500">标准差</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in store.scenarioComparisonData" :key="row.scenarioId" class="border-b border-slate-700/50">
                    <td class="py-2 px-1 text-slate-300">{{ row.scenarioName }}</td>
                    <td class="py-2 px-1 text-right text-slate-400">{{ row.runCount }}</td>
                    <td class="py-2 px-1 text-right text-cyan-400 font-mono">{{ row.avg.toFixed(4) }}</td>
                    <td class="py-2 px-1 text-right text-orange-400 font-mono">{{ row.std.toFixed(4) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="store.groupedBatchResults.length > 0" class="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h3 class="text-sm font-bold text-slate-400 mb-3">批次结果详情</h3>
            <div class="space-y-3 max-h-80 overflow-y-auto">
              <div v-for="group in store.groupedBatchResults" :key="group.batchId">
                <div class="text-xs font-bold text-emerald-400 mb-1">{{ group.batchName }}</div>
                <div class="space-y-1">
                  <div v-for="r in group.results" :key="r.stepId" class="bg-slate-900 rounded p-2 text-xs flex justify-between">
                    <span class="text-slate-400">{{ r.scenarioName }}</span>
                    <span class="text-cyan-400 font-mono">{{ r.result.estimate.toFixed(6) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showNewPlanModal" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" @click.self="showNewPlanModal = false">
      <div class="bg-slate-800 rounded-lg p-6 w-96 border border-slate-700">
        <h3 class="text-lg font-bold text-emerald-400 mb-4">创建实验方案</h3>
        <div class="space-y-4">
          <div>
            <label class="text-xs text-slate-500 block mb-1">方案名称</label>
            <input v-model="newPlanName" type="text" placeholder="输入方案名称" class="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label class="text-xs text-slate-500 block mb-1">方案描述</label>
            <textarea v-model="newPlanDesc" rows="3" placeholder="输入方案描述" class="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 resize-none"></textarea>
          </div>
          <div class="flex justify-end gap-2">
            <button @click="showNewPlanModal = false" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm">取消</button>
            <button @click="createNewPlan" :disabled="!newPlanName.trim()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded text-sm font-bold">创建</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { useMCStore, SCENARIOS, type ExperimentPlan } from './store/mc'

const store = useMCStore()
const convergenceRef = ref<HTMLDivElement | null>(null)
const histogramRef = ref<HTMLDivElement | null>(null)
const comparisonChartRef = ref<HTMLDivElement | null>(null)
const group1Input = ref('5.1,4.8,5.3,4.9,5.2,5.0,4.7,5.1,5.4,4.8')
const group2Input = ref('4.6,4.2,4.9,4.3,4.5,4.7,4.4,4.8,4.1,4.6')

const activeTab = ref<'simulation' | 'experiment'>('simulation')
const showNewPlanModal = ref(false)
const newPlanName = ref('')
const newPlanDesc = ref('')
const batchCount = ref(3)

let convChart: echarts.ECharts | null = null
let histChart: echarts.ECharts | null = null
let compChart: echarts.ECharts | null = null

function initCharts() {
  if (convergenceRef.value) convChart = echarts.init(convergenceRef.value, 'dark')
  if (histogramRef.value) histChart = echarts.init(histogramRef.value, 'dark')
}

function initComparisonChart() {
  if (comparisonChartRef.value && !compChart) {
    compChart = echarts.init(comparisonChartRef.value, 'dark')
  }
}

function updateCharts() {
  if (convChart && store.convergenceData.length > 0) {
    convChart.setOption({
      backgroundColor: '#0f172a',
      grid: { top: 20, bottom: 35, left: 65, right: 20 },
      xAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 10 } },
      yAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 10 } },
      series: [{ type: 'line', data: store.convergenceData, smooth: true, lineStyle: { color: '#06b6d4', width: 2 }, areaStyle: { color: 'rgba(6,182,212,0.1)' }, symbol: 'none' }],
      tooltip: { trigger: 'axis', backgroundColor: '#1e293b', borderColor: '#475569' }
    })
  }
  if (histChart && store.histogramData.xAxis.length > 0) {
    histChart.setOption({
      backgroundColor: '#0f172a',
      grid: { top: 15, bottom: 40, left: 55, right: 15 },
      xAxis: { type: 'category', data: store.histogramData.xAxis, axisLabel: { color: '#94a3b8', fontSize: 9, rotate: 30 } },
      yAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 10 } },
      series: [{ type: 'bar', data: store.histogramData.data, itemStyle: { color: '#8b5cf6' } }],
      tooltip: { trigger: 'axis', backgroundColor: '#1e293b', borderColor: '#475569' }
    })
  }
}

function updateComparisonChart() {
  if (!compChart || store.scenarioComparisonData.length === 0) return

  const colors = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9']
  const series = store.scenarioComparisonData.map((d, i) => ({
    name: d.scenarioName,
    type: 'bar',
    data: d.estimates,
    itemStyle: { color: colors[i % colors.length] }
  }))

  const maxLen = Math.max(...store.scenarioComparisonData.map(d => d.estimates.length))
  const xAxisData = Array.from({ length: maxLen }, (_, i) => `第${i + 1}次`)

  compChart.setOption({
    backgroundColor: '#0f172a',
    grid: { top: 40, bottom: 35, left: 55, right: 20 },
    legend: { textStyle: { color: '#94a3b8', fontSize: 10 }, top: 0 },
    xAxis: { type: 'category', data: xAxisData, axisLabel: { color: '#94a3b8', fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 10 } },
    series,
    tooltip: { trigger: 'axis', backgroundColor: '#1e293b', borderColor: '#475569' }
  })
}

function runTest() {
  const g1 = group1Input.value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))
  const g2 = group2Input.value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))
  if (g1.length > 1 && g2.length > 1) store.runTest(g1, g2)
}

function getScenarioName(id: string): string {
  return SCENARIOS.find(s => s.id === id)?.name || id
}

function selectPlan(plan: ExperimentPlan) {
  store.setCurrentPlan(plan)
}

function createNewPlan() {
  if (!newPlanName.value.trim()) return
  const plan = store.createPlan(newPlanName.value.trim(), newPlanDesc.value.trim())
  store.setCurrentPlan(plan)
  newPlanName.value = ''
  newPlanDesc.value = ''
  showNewPlanModal.value = false
}

function deletePlan(planId: string) {
  if (confirm('确定要删除这个实验方案吗？')) {
    store.deletePlan(planId)
  }
}

function addStepToPlan(scenarioId: string) {
  if (store.currentPlan) {
    store.addStep(store.currentPlan.id, scenarioId)
  }
}

function removeStep(stepId: string) {
  if (store.currentPlan) {
    store.removeStep(store.currentPlan.id, stepId)
  }
}

function moveStep(stepId: string, direction: number) {
  if (!store.currentPlan) return
  const step = store.currentPlan.steps.find(s => s.id === stepId)
  if (!step) return
  store.reorderStep(store.currentPlan.id, stepId, step.order + direction)
}

function updateStepParam(stepId: string, key: string, value: number) {
  if (!store.currentPlan || isNaN(value)) return
  const step = store.currentPlan.steps.find(s => s.id === stepId)
  if (!step) return
  store.updateStep(store.currentPlan.id, stepId, { params: { ...step.params, [key]: value } })
}

async function runExperiment() {
  if (!store.currentPlan || store.currentPlan.steps.length === 0) return
  await store.runExperimentBatch(store.currentPlan, batchCount.value)
  await nextTick()
  initComparisonChart()
  updateComparisonChart()
}

watch(() => store.result, () => updateCharts(), { deep: true })
watch(() => store.batchResults, () => {
  nextTick(() => {
    initComparisonChart()
    updateComparisonChart()
  })
}, { deep: true })
watch(activeTab, (tab) => {
  if (tab === 'experiment') {
    nextTick(() => {
      initComparisonChart()
      updateComparisonChart()
    })
  } else {
    nextTick(() => {
      initCharts()
      updateCharts()
    })
  }
})

onMounted(() => {
  initCharts()
  store.runSimulation()
})
</script>
