from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import numpy as np
from scipy import stats
import uuid
import time

app = FastAPI(title="Monte Carlo API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class ExperimentStep(BaseModel):
    id: Optional[str] = None
    scenarioId: str
    iterations: int
    params: Dict[str, float]
    order: int

class ExperimentPlan(BaseModel):
    id: Optional[str] = None
    name: str
    description: str
    steps: List[ExperimentStep]
    createdAt: Optional[float] = None
    updatedAt: Optional[float] = None

class MCResult(BaseModel):
    scenario: str
    iterations: int
    estimate: float
    trueValue: Optional[float] = None
    error: Optional[float] = None
    samples: List[float]
    convergence: List[float]

class BatchResult(BaseModel):
    batchId: str
    batchName: str
    stepId: str
    scenarioId: str
    scenarioName: str
    result: MCResult
    runAt: float
    duration: float

class BatchRunRequest(BaseModel):
    plan: ExperimentPlan
    batches: int = 3

plans_db: Dict[str, ExperimentPlan] = {}

def normal_random() -> float:
    return np.random.normal()

def run_mc(scenario_id: str, params: Dict[str, float], n: int) -> MCResult:
    if scenario_id == 'pi':
        inside = 0
        samples = []
        convergence = []
        for i in range(n):
            x = np.random.uniform(-1, 1)
            y = np.random.uniform(-1, 1)
            is_inside = x * x + y * y <= 1
            if is_inside:
                inside += 1
            samples.append(1.0 if is_inside else 0.0)
            convergence.append((inside / (i + 1)) * 4)
        estimate = (inside / n) * 4
        return MCResult(
            scenario='pi', iterations=n, estimate=estimate,
            trueValue=np.pi, error=abs(estimate - np.pi),
            samples=samples, convergence=convergence
        )
    elif scenario_id == 'brownian':
        dt = params.get('dt', 0.01)
        pos = 0.0
        samples = []
        for i in range(n):
            pos += normal_random() * np.sqrt(dt)
            samples.append(pos)
        return MCResult(
            scenario='brownian', iterations=n, estimate=pos,
            samples=samples, convergence=samples[:200]
        )
    elif scenario_id == 'option':
        S0 = params.get('S0', 100)
        K = params.get('K', 105)
        r = params.get('r', 0.05)
        sigma = params.get('sigma', 0.2)
        T = params.get('T', 1)
        payoff_sum = 0.0
        samples = []
        convergence = []
        for i in range(n):
            ST = S0 * np.exp((r - 0.5 * sigma * sigma) * T + sigma * np.sqrt(T) * normal_random())
            p = max(ST - K, 0)
            payoff_sum += p
            samples.append(p)
            if (i + 1) % 50 == 0:
                convergence.append((payoff_sum / (i + 1)) * np.exp(-r * T))
        estimate = (payoff_sum / n) * np.exp(-r * T)
        return MCResult(
            scenario='option', iterations=n, estimate=estimate,
            samples=samples, convergence=convergence
        )
    elif scenario_id == 'random_walk':
        pos = 0.0
        samples = []
        for i in range(n):
            pos += 1 if np.random.random() > 0.5 else -1
            samples.append(pos)
        return MCResult(
            scenario='random_walk', iterations=n, estimate=pos,
            samples=samples, convergence=samples[:200]
        )
    elif scenario_id == 'diffusion':
        D = params.get('D', 1.0)
        dt = params.get('dt', 0.01)
        x, y = 0.0, 0.0
        samples = []
        for i in range(n):
            x += normal_random() * np.sqrt(2 * D * dt)
            y += normal_random() * np.sqrt(2 * D * dt)
            samples.append(np.sqrt(x * x + y * y))
        return MCResult(
            scenario='diffusion', iterations=n, estimate=np.sqrt(x * x + y * y),
            samples=samples, convergence=samples[:200]
        )
    elif scenario_id == 'gambler':
        p = params.get('p', 0.45)
        bankroll = params.get('bankroll', 50)
        goal = params.get('goal', 100)
        ruin_count = 0
        samples = []
        convergence = []
        for i in range(n):
            money = bankroll
            steps = 0
            while money > 0 and money < goal and steps < 10000:
                money += 1 if np.random.random() < p else -1
                steps += 1
            if money <= 0:
                ruin_count += 1
            samples.append(0.0 if money <= 0 else 1.0)
            convergence.append(ruin_count / (i + 1))
        return MCResult(
            scenario='gambler', iterations=n, estimate=ruin_count / n,
            samples=samples, convergence=convergence
        )
    else:
        raise ValueError(f"Unknown scenario: {scenario_id}")

SCENARIO_NAMES = {
    'pi': '圆周率π估算',
    'brownian': '布朗运动模拟',
    'option': '欧式期权定价',
    'random_walk': '随机游走',
    'diffusion': '粒子扩散',
    'gambler': '赌徒破产'
}

@app.get("/")
def root():
    return {"service": "Monte Carlo API", "status": "running"}

@app.post("/api/plans")
def create_plan(plan: ExperimentPlan):
    plan.id = str(uuid.uuid4())
    now = time.time()
    plan.createdAt = now
    plan.updatedAt = now
    for i, step in enumerate(plan.steps):
        if not step.id:
            step.id = str(uuid.uuid4())
        step.order = i
    plans_db[plan.id] = plan
    return plan

@app.get("/api/plans")
def list_plans():
    return list(plans_db.values())

@app.get("/api/plans/{plan_id}")
def get_plan(plan_id: str):
    if plan_id not in plans_db:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plans_db[plan_id]

@app.put("/api/plans/{plan_id}")
def update_plan(plan_id: str, plan: ExperimentPlan):
    if plan_id not in plans_db:
        raise HTTPException(status_code=404, detail="Plan not found")
    plan.id = plan_id
    plan.updatedAt = time.time()
    if plan.createdAt is None:
        plan.createdAt = plans_db[plan_id].createdAt
    for i, step in enumerate(plan.steps):
        if not step.id:
            step.id = str(uuid.uuid4())
        step.order = i
    plans_db[plan_id] = plan
    return plan

@app.delete("/api/plans/{plan_id}")
def delete_plan(plan_id: str):
    if plan_id not in plans_db:
        raise HTTPException(status_code=404, detail="Plan not found")
    del plans_db[plan_id]
    return {"success": True}

@app.post("/api/run-batch")
def run_batch(request: BatchRunRequest):
    results: List[BatchResult] = []
    for b in range(request.batches):
        for step in request.plan.steps:
            start = time.time()
            mc_result = run_mc(step.scenarioId, step.params, step.iterations)
            duration = time.time() - start
            results.append(BatchResult(
                batchId=f"batch_{b}",
                batchName=f"第{b + 1}批",
                stepId=step.id or str(uuid.uuid4()),
                scenarioId=step.scenarioId,
                scenarioName=SCENARIO_NAMES.get(step.scenarioId, step.scenarioId),
                result=mc_result,
                runAt=time.time(),
                duration=duration
            ))
    return results

@app.post("/api/simulate/{scenario_id}")
def simulate(scenario_id: str, iterations: int = 1000, params: Optional[Dict[str, float]] = None):
    if params is None:
        params = {}
    return run_mc(scenario_id, params, iterations)

@app.post("/api/ttest")
def t_test(group1: List[float], group2: List[float], alpha: float = 0.05):
    if len(group1) < 2 or len(group2) < 2:
        raise HTTPException(status_code=400, detail="Each group must have at least 2 samples")
    t_stat, p_value = stats.ttest_ind(group1, group2, equal_var=False)
    return {
        "testType": "Welch T检验",
        "statistic": float(t_stat),
        "pValue": float(p_value),
        "significant": p_value < alpha,
        "alpha": alpha,
        "df": float(stats.ttest_ind(group1, group2, equal_var=False).df)
    }
