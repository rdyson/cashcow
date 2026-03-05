<script lang="ts">
	import { onMount } from 'svelte';
	import { runProjection, classifyOutcome } from '$lib/projection.js';
	import { calculateTakeHome, selfTest } from '$lib/tax.js';
	import type { ClientProfile, ProjectionYear, ProjectionOutcome } from '$lib/projection.js';
	import { Chart, registerables } from 'chart.js';
	import { theme } from '$lib/theme.svelte';

	Chart.register(...registerables);

	// ─── Chart theme colours ───────────────────────────────────────────────────

	function chartColors(isLuxury: boolean) {
		if (isLuxury) {
			// Luxury: dark velvet bg, gold accents
			return {
				legendColor: '#dca54c',
				tickColor: '#9b9bb4',
				gridColor: 'rgba(220,165,76,0.08)',
				tooltipBg: '#1a1a2e',
				tooltipTitle: '#dca54c',
				tooltipBody: '#9b9bb4',
				axisLabelColor: '#9b9bb4',
			};
		} else {
			// Dark (cool blue)
			return {
				legendColor: '#e2e8f0',
				tickColor: '#94a3b8',
				gridColor: 'rgba(255,255,255,0.06)',
				tooltipBg: '#1e293b',
				tooltipTitle: '#f1f5f9',
				tooltipBody: '#cbd5e1',
				axisLabelColor: '#94a3b8',
			};
		}
	}

	// ─── State ────────────────────────────────────────────────────────────────

	let profile = $state<ClientProfile>({
		currentAge: 35,
		salary: 50_000,
		retirementAge: 65,
		currentPensionPot: 40_000,
		employerContributionPct: 5,
		employeeContributionPct: 5,
		currentISABalance: 10_000,
		retirementSpending: 30_000,
		salaryGrowthRate: 0.02,
		investmentGrowthRate: 0.05,
		inflationRate: 0.025,
	});

	let years = $derived(runProjection(profile));
	let outcome = $derived(classifyOutcome(years));
	let taxBreakdown = $derived(calculateTakeHome(profile.salary));
	let selfTestPassed = $state<boolean | null>(null);

	let chartCanvas = $state<HTMLCanvasElement | null>(null);
	let chart: Chart | null = null;

	// ─── Compute ───────────────────────────────────────────────────────────────

	// Single effect: update chart when data or theme changes
	$effect(() => {
		const _years = years; // track projection data
		const isDark = theme.isDark; // track theme
		updateChart(!isDark); // isLuxury = !isDark
	});

	// ─── Chart ────────────────────────────────────────────────────────────────

	function buildChartData() {
		const labels = years.map((y) => `${y.age}`);
		const wealth = years.map((y) => Math.round(y.totalWealth / 1000));
		const pensionPot = years.map((y) => Math.round(y.pensionPot / 1000));
		const isaPot = years.map((y) => Math.round(y.isaPot / 1000));
		const surplus = years.map((y) => Math.round(y.surplus / 1000));

		return { labels, wealth, pensionPot, isaPot, surplus };
	}

	function buildChartOptions(isLuxury: boolean) {
		const c = chartColors(isLuxury);
		return {
			responsive: true,
			maintainAspectRatio: false,
			interaction: { mode: 'index' as const, intersect: false },
			plugins: {
				legend: {
					labels: { color: c.legendColor, font: { family: 'inherit', size: 12 } },
				},
				tooltip: {
					backgroundColor: c.tooltipBg,
					titleColor: c.tooltipTitle,
					bodyColor: c.tooltipBody,
					callbacks: {
						label: (ctx: any) => ` ${ctx.dataset.label}: £${ctx.parsed.y.toLocaleString()}k`,
					},
				},
			},
			scales: {
				x: {
					ticks: { color: c.tickColor, maxTicksLimit: 15 },
					grid: { color: c.gridColor },
					title: { display: true, text: 'Age', color: c.axisLabelColor },
				},
				y: {
					ticks: {
						color: c.tickColor,
						callback: (v: any) => `£${Number(v).toLocaleString()}k`,
					},
					grid: { color: c.gridColor },
					title: { display: true, text: 'Value (£k)', color: c.axisLabelColor },
				},
			},
		};
	}

	function updateChart(isLuxury = !theme.isDark) {
		if (!chartCanvas) return;
		const { labels, pensionPot, isaPot, surplus } = buildChartData();

		if (chart) {
			chart.data.labels = labels;
			chart.data.datasets[0].data = pensionPot;
			chart.data.datasets[1].data = isaPot;
			chart.data.datasets[2].data = surplus;
			Object.assign(chart.options, buildChartOptions(isLuxury));
			chart.update('none');
			return;
		}

		chart = new Chart(chartCanvas, {
			type: 'line',
			data: {
				labels,
				datasets: [
					{
						label: 'Pension Pot (£k)',
						data: pensionPot,
						borderColor: '#818cf8',
						backgroundColor: 'rgba(129,140,248,0.15)',
						fill: true,
						tension: 0.3,
						pointRadius: 0,
					},
					{
						label: 'ISA Pot (£k)',
						data: isaPot,
						borderColor: '#34d399',
						backgroundColor: 'rgba(52,211,153,0.15)',
						fill: true,
						tension: 0.3,
						pointRadius: 0,
					},
					{
						label: 'Annual Surplus/Deficit (£k)',
						data: surplus,
						borderColor: '#fb923c',
						backgroundColor: 'rgba(251,146,60,0.1)',
						fill: false,
						tension: 0.3,
						pointRadius: 0,
						borderDash: [4, 4],
					},
				],
			},
			options: buildChartOptions(!theme.isDark),
		});
	}

	// ─── Lifecycle ─────────────────────────────────────────────────────────────

	onMount(() => {
		selfTestPassed = selfTest();
	});

	// ─── Helpers ───────────────────────────────────────────────────────────────

	const STATE_PENSION_AGE = 67;

	const fmt = (n: number) =>
		new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
	const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

	// Traffic light alert type mapping
	function alertClass(light: string) {
		if (light === 'green') return 'alert-success';
		if (light === 'amber') return 'alert-warning';
		return 'alert-error';
	}
</script>

<main class="container mx-auto max-w-7xl px-4 py-6">
	<!-- Header -->
	<header class="mb-8">
		<div class="flex items-center gap-3 mb-2">
			<span class="text-4xl">🐄</span>
			<h1 class="text-3xl font-bold tracking-tight text-primary">CashCow</h1>
		</div>
		<p class="text-base-content/60 text-sm max-w-xl">
			UK cashflow modelling for trainee financial advisers. See the numbers, understand the rules,
			build your intuition.
		</p>
		{#if selfTestPassed !== null}
			<div class="badge {selfTestPassed ? 'badge-success' : 'badge-error'} badge-sm mt-2 gap-1">
				{selfTestPassed ? '✓' : '✗'} Tax engine {selfTestPassed ? 'verified' : 'self-test failed'}
			</div>
		{/if}
	</header>

	<div class="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
		<!-- ── Left panel: Inputs ────────────────────────────────────────── -->
		<aside class="space-y-4">

			<!-- Client Profile -->
			<div class="card bg-base-200 shadow-xl">
				<div class="card-body gap-4 p-5">
					<h2 class="card-title text-base text-primary">Client Profile</h2>

					<div class="grid grid-cols-2 gap-3">
						<fieldset class="fieldset p-0">
							<legend class="fieldset-legend text-xs text-base-content/70">Current Age</legend>
							<input class="input input-sm w-full" type="number" id="age" min="18" max="80"
								value={profile.currentAge}
								onchange={(e) => profile.currentAge = +e.currentTarget.value} />
						</fieldset>
						<fieldset class="fieldset p-0">
							<legend class="fieldset-legend text-xs text-base-content/70">Retirement Age</legend>
							<input class="input input-sm w-full" type="number" id="retirement-age" min="50" max="80"
								value={profile.retirementAge}
								onchange={(e) => profile.retirementAge = +e.currentTarget.value} />
						</fieldset>
					</div>

					<fieldset class="fieldset p-0">
						<legend class="fieldset-legend text-xs text-base-content/70">Gross Salary</legend>
						<label class="input input-sm w-full">
							<span class="text-base-content/50 text-sm">£</span>
							<input type="number" id="salary"
								value={profile.salary}
								onchange={(e) => profile.salary = +e.currentTarget.value} />
						</label>
					</fieldset>

					<div class="grid grid-cols-2 gap-3">
						<fieldset class="fieldset p-0">
							<legend class="fieldset-legend text-xs text-base-content/70">Employer Pension %</legend>
							<input class="input input-sm w-full" type="number" min="0" max="30" step="0.5"
								value={profile.employerContributionPct}
								onchange={(e) => profile.employerContributionPct = +e.currentTarget.value} />
						</fieldset>
						<fieldset class="fieldset p-0">
							<legend class="fieldset-legend text-xs text-base-content/70">Employee Pension %</legend>
							<input class="input input-sm w-full" type="number" min="0" max="30" step="0.5"
								value={profile.employeeContributionPct}
								onchange={(e) => profile.employeeContributionPct = +e.currentTarget.value} />
						</fieldset>
					</div>

					<div class="grid grid-cols-2 gap-3">
						<fieldset class="fieldset p-0">
							<legend class="fieldset-legend text-xs text-base-content/70">Current Pension Pot</legend>
							<label class="input input-sm w-full">
								<span class="text-base-content/50 text-sm">£</span>
								<input type="number"
									value={profile.currentPensionPot}
									onchange={(e) => profile.currentPensionPot = +e.currentTarget.value} />
							</label>
						</fieldset>
						<fieldset class="fieldset p-0">
							<legend class="fieldset-legend text-xs text-base-content/70">Current ISA Balance</legend>
							<label class="input input-sm w-full">
								<span class="text-base-content/50 text-sm">£</span>
								<input type="number"
									value={profile.currentISABalance}
									onchange={(e) => profile.currentISABalance = +e.currentTarget.value} />
							</label>
						</fieldset>
					</div>

					<fieldset class="fieldset p-0">
						<legend class="fieldset-legend text-xs text-base-content/70">Retirement Spending Target (today's £)</legend>
						<label class="input input-sm w-full">
							<span class="text-base-content/50 text-sm">£</span>
							<input type="number"
								value={profile.retirementSpending}
								onchange={(e) => profile.retirementSpending = +e.currentTarget.value} />
						</label>
						<p class="fieldset-label text-xs text-base-content/50 mt-1">The "number" — what does a good retirement cost?</p>
					</fieldset>
				</div>
			</div>

			<!-- Scenario Slider -->
			<div class="card bg-base-200 shadow-xl">
				<div class="card-body gap-3 p-5">
					<div>
						<h2 class="card-title text-base text-primary">Retirement Age Scenario</h2>
						<p class="text-xs text-base-content/50">Drag to see impact live</p>
					</div>
					<div class="flex items-center justify-between text-sm">
						<span class="text-base-content/60">Age</span>
						<span class="font-bold text-2xl tabular-nums text-primary">{profile.retirementAge}</span>
					</div>
					<input
						type="range"
						class="range range-primary range-sm"
						min={50}
						max={75}
						step={1}
						value={profile.retirementAge}
						oninput={(e) => (profile.retirementAge = +e.currentTarget.value)}
					/>
					<div class="flex justify-between text-xs text-base-content/50">
						<span>50</span><span>75</span>
					</div>
				</div>
			</div>

			<!-- Assumptions -->
			<div class="card bg-base-200 shadow-xl">
				<div class="card-body gap-3 p-5">
					<h2 class="card-title text-base text-primary">Assumptions</h2>
					<div class="grid grid-cols-3 gap-2">
						<fieldset class="fieldset p-0">
							<legend class="fieldset-legend text-xs text-base-content/70">Salary Growth</legend>
							<label class="input input-sm w-full">
								<input type="number" step="0.1" min="0" max="10"
									value={(profile.salaryGrowthRate * 100).toFixed(1)}
									onchange={(e) => profile.salaryGrowthRate = +e.currentTarget.value / 100} />
								<span class="text-base-content/50 text-xs">%</span>
							</label>
						</fieldset>
						<fieldset class="fieldset p-0">
							<legend class="fieldset-legend text-xs text-base-content/70">Investment Growth</legend>
							<label class="input input-sm w-full">
								<input type="number" step="0.1" min="0" max="15"
									value={(profile.investmentGrowthRate * 100).toFixed(1)}
									onchange={(e) => profile.investmentGrowthRate = +e.currentTarget.value / 100} />
								<span class="text-base-content/50 text-xs">%</span>
							</label>
						</fieldset>
						<fieldset class="fieldset p-0">
							<legend class="fieldset-legend text-xs text-base-content/70">Inflation</legend>
							<label class="input input-sm w-full">
								<input type="number" step="0.1" min="0" max="10"
									value={(profile.inflationRate * 100).toFixed(1)}
									onchange={(e) => profile.inflationRate = +e.currentTarget.value / 100} />
								<span class="text-base-content/50 text-xs">%</span>
							</label>
						</fieldset>
					</div>
					<p class="text-xs text-base-content/50">
						State Pension: {fmt(11_973)}/yr from age 67 (full new State Pension 2025/26)
					</p>
				</div>
			</div>

			<!-- Tax Breakdown for current salary -->
			<div class="card bg-base-200 shadow-xl">
				<div class="card-body gap-3 p-5">
					<div>
						<h2 class="card-title text-base text-primary">Current Year Tax Breakdown</h2>
						<p class="text-xs text-base-content/50">2025/26 rates — England/Wales/NI</p>
					</div>
					<dl class="space-y-2 text-sm">
						<div class="flex justify-between">
							<dt class="text-base-content/60">Gross salary</dt>
							<dd class="font-mono">{fmt(taxBreakdown.grossIncome)}</dd>
						</div>
						<div class="flex justify-between">
							<dt class="text-base-content/60">Personal Allowance</dt>
							<dd class="font-mono">{fmt(taxBreakdown.personalAllowance)}</dd>
						</div>
						<div class="divider my-1"></div>
						<div class="flex justify-between">
							<dt class="text-base-content/60">Basic rate tax (20%)</dt>
							<dd class="font-mono text-warning">−{fmt(taxBreakdown.incomeTax.basicRateTax)}</dd>
						</div>
						{#if taxBreakdown.incomeTax.higherRateTax > 0}
						<div class="flex justify-between">
							<dt class="text-base-content/60">Higher rate tax (40%)</dt>
							<dd class="font-mono text-error">−{fmt(taxBreakdown.incomeTax.higherRateTax)}</dd>
						</div>
						{/if}
						{#if taxBreakdown.incomeTax.additionalRateTax > 0}
						<div class="flex justify-between">
							<dt class="text-base-content/60">Additional rate tax (45%)</dt>
							<dd class="font-mono text-error">−{fmt(taxBreakdown.incomeTax.additionalRateTax)}</dd>
						</div>
						{/if}
						<div class="flex justify-between">
							<dt class="text-base-content/60">NI main (8%)</dt>
							<dd class="font-mono text-warning">−{fmt(taxBreakdown.ni.mainRateNI)}</dd>
						</div>
						{#if taxBreakdown.ni.upperRateNI > 0}
						<div class="flex justify-between">
							<dt class="text-base-content/60">NI upper (2%)</dt>
							<dd class="font-mono text-warning">−{fmt(taxBreakdown.ni.upperRateNI)}</dd>
						</div>
						{/if}
						<div class="divider my-1"></div>
						<div class="flex justify-between font-semibold">
							<dt>Net take-home</dt>
							<dd class="font-mono text-success">{fmt(taxBreakdown.takeHome)}</dd>
						</div>
						<div class="flex justify-between text-xs">
							<dt class="text-base-content/50">Effective tax rate</dt>
							<dd class="text-base-content/50">{fmtPct(taxBreakdown.effectiveTaxRate)}</dd>
						</div>
					</dl>
				</div>
			</div>
		</aside>

		<!-- ── Right panel: Chart + Summary ─────────────────────────────── -->
		<section class="space-y-4">

			<!-- Traffic Light Outcome -->
			{#if outcome}
			<div class="alert {alertClass(outcome.trafficLight)} shadow-lg">
				<span class="text-4xl" role="img" aria-label="status">
					{#if outcome.trafficLight === 'green'}🟢
					{:else if outcome.trafficLight === 'amber'}🟡
					{:else}🔴{/if}
				</span>
				<div>
					<p class="font-semibold text-lg">{outcome.summary}</p>
					<p class="text-sm opacity-80">
						Retirement at {profile.retirementAge} ·
						{outcome.moneyRunsOutAge === null
							? `${fmt(outcome.finalWealth)} left at 100`
							: `Shortfall from age ${outcome.moneyRunsOutAge}`}
					</p>
				</div>
			</div>
			{/if}

			<!-- Chart -->
			<div class="card bg-base-200 shadow-xl">
				<div class="card-body p-5">
					<h2 class="card-title text-base text-primary">Cashflow Projection — Age {profile.currentAge} to 100</h2>
					<div class="h-72 sm:h-96">
						<canvas bind:this={chartCanvas}></canvas>
					</div>
				</div>
			</div>

			<!-- Key Milestone Stats — DaisyUI stats component -->
			<div class="stats stats-horizontal shadow w-full bg-base-200 flex-wrap">
				{#each [
					{ label: 'At Retirement', value: fmt(years.find(y => y.age === profile.retirementAge)?.totalWealth ?? 0) },
					{ label: 'Peak Wealth', value: fmt(Math.max(...years.map(y => y.totalWealth))) },
					{ label: 'At Age 80', value: fmt(years.find(y => y.age === 80)?.totalWealth ?? 0) },
					{ label: 'At Age 100', value: fmt(years.find(y => y.age === 100)?.totalWealth ?? 0) },
				] as stat}
				<div class="stat">
					<div class="stat-title text-xs">{stat.label}</div>
					<div class="stat-value text-base text-primary tabular-nums">{stat.value}</div>
				</div>
				{/each}
			</div>

			<!-- Year-by-year table -->
			<div class="card bg-base-200 shadow-xl">
				<div class="card-body p-5">
					<h2 class="card-title text-base text-primary">Year-by-Year Detail</h2>
				</div>
				<div class="overflow-x-auto">
					<table class="table table-xs table-zebra w-full">
						<thead>
							<tr>
								<th>Age</th>
								<th class="text-right">Phase</th>
								<th class="text-right">Income</th>
								<th class="text-right">Tax+NI</th>
								<th class="text-right">Spending</th>
								<th class="text-right">Surplus</th>
								<th class="text-right">Pension Pot</th>
								<th class="text-right">ISA Pot</th>
							</tr>
						</thead>
						<tbody>
							{#each years as y}
							<tr class="
								{y.surplus < 0 ? 'text-error' : ''}
								{y.age === profile.retirementAge ? 'bg-primary/10 font-semibold' : ''}
								{y.age === STATE_PENSION_AGE ? 'bg-success/10' : ''}
							">
								<td class="tabular-nums">{y.age}</td>
								<td class="text-right">
									{#if y.age === profile.retirementAge}
										<span class="text-primary">🎯 Retire</span>
									{:else if y.age === 67 && y.isRetired}
										<span class="text-success">🏛️ SP</span>
									{:else if y.isWorking}
										<span class="text-base-content/40">Work</span>
									{:else}
										<span class="text-base-content/40">Ret.</span>
									{/if}
								</td>
								<td class="text-right tabular-nums">{fmt(y.totalIncome)}</td>
								<td class="text-right tabular-nums text-warning">
									{y.incomeTax + y.employeeNI > 0 ? fmt(y.incomeTax + y.employeeNI) : '—'}
								</td>
								<td class="text-right tabular-nums">{fmt(y.spending)}</td>
								<td class="text-right tabular-nums {y.surplus >= 0 ? 'text-success' : 'text-error'}">
									{y.surplus >= 0 ? '+' : ''}{fmt(y.surplus)}
								</td>
								<td class="text-right tabular-nums">{fmt(y.pensionPot)}</td>
								<td class="text-right tabular-nums">{fmt(y.isaPot)}</td>
							</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Educational notes -->
			<div class="card bg-base-200/50 border border-primary/20 shadow-xl">
				<div class="card-body p-5 gap-2">
					<h2 class="card-title text-sm text-primary">💡 How It Works</h2>
					<div class="text-xs text-base-content/60 space-y-1.5">
						<p><strong class="text-base-content/80">Working years:</strong> Pension grows via employer + employee contributions + investment growth. ISA receives surplus take-home after spending.</p>
						<p><strong class="text-base-content/80">At retirement:</strong> 25% tax-free lump sum taken (up to the £268,275 Lump Sum Allowance), moved to savings.</p>
						<p><strong class="text-base-content/80">Retirement income:</strong> ISA withdrawals first (tax-free), then State Pension from 67, then taxable pension drawdown to cover the rest.</p>
						<p><strong class="text-base-content/80">Tax:</strong> 2025/26 England/Wales/NI rates. Personal allowance tapers £1 per £2 above £100k, reaching zero at £125,140.</p>
					</div>
				</div>
			</div>
		</section>
	</div>
</main>
