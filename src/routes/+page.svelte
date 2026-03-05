<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Slider } from '$lib/components/ui/slider';
	import { runProjection, classifyOutcome } from '$lib/projection.js';
	import { calculateTakeHome, selfTest } from '$lib/tax.js';
	import type { ClientProfile, ProjectionYear, ProjectionOutcome } from '$lib/projection.js';
	import { Chart, registerables } from 'chart.js';
	import { theme } from '$lib/theme.svelte';

	Chart.register(...registerables);

	// ─── Chart theme colours ───────────────────────────────────────────────────

	function chartColors(isDark: boolean) {
		if (isDark) {
			return {
				legendColor: '#e2e8f0',
				tickColor: '#94a3b8',
				gridColor: 'rgba(255,255,255,0.06)',
				tooltipBg: '#1e293b',
				tooltipTitle: '#f1f5f9',
				tooltipBody: '#cbd5e1',
				axisLabelColor: '#94a3b8',
			};
		} else {
			return {
				legendColor: '#1e293b',
				tickColor: '#475569',
				gridColor: 'rgba(0,0,0,0.07)',
				tooltipBg: '#1e293b',
				tooltipTitle: '#f8fafc',
				tooltipBody: '#94a3b8',
				axisLabelColor: '#475569',
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

	let years = $state<ProjectionYear[]>([]);
	let outcome = $state<ProjectionOutcome | null>(null);
	let taxBreakdown = $derived(calculateTakeHome(profile.salary));
	let selfTestPassed = $state<boolean | null>(null);

	let chartCanvas = $state<HTMLCanvasElement | null>(null);
	let chart: Chart | null = null;

	// ─── Compute ───────────────────────────────────────────────────────────────

	function compute() {
		years = runProjection(profile);
		outcome = classifyOutcome(years);
		updateChart();
	}

	$effect(() => {
		// Reactive: recompute whenever profile changes
		const _ = { ...profile };
		compute();
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

	function buildChartOptions(isDark: boolean) {
		const c = chartColors(isDark);
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

	function updateChart() {
		if (!chartCanvas) return;
		const { labels, pensionPot, isaPot, surplus } = buildChartData();

		if (chart) {
			chart.data.labels = labels;
			chart.data.datasets[0].data = pensionPot;
			chart.data.datasets[1].data = isaPot;
			chart.data.datasets[2].data = surplus;
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
			options: buildChartOptions(theme.isDark),
		});
	}

	function applyChartTheme(isDark: boolean) {
		if (!chart) return;
		const opts = buildChartOptions(isDark);
		// @ts-expect-error deep option merge
		Object.assign(chart.options, opts);
		chart.update('none');
	}

	// Re-theme chart when dark mode changes
	$effect(() => {
		const isDark = theme.isDark;
		applyChartTheme(isDark);
	});

	// ─── Lifecycle ─────────────────────────────────────────────────────────────

	onMount(() => {
		selfTestPassed = selfTest();
		compute();
	});

	// ─── Helpers ───────────────────────────────────────────────────────────────

	const STATE_PENSION_AGE = 67;

	const fmt = (n: number) =>
		new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
	const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
</script>

<main class="container mx-auto max-w-7xl px-4 py-6">
	<!-- Header -->
	<header class="mb-8">
		<div class="flex items-center gap-3 mb-2">
			<span class="text-4xl">🐄</span>
			<h1 class="text-3xl font-bold tracking-tight">CashCow</h1>
		</div>
		<p class="text-muted-foreground text-sm max-w-xl">
			UK cashflow modelling for trainee financial advisers. See the numbers, understand the rules,
			build your intuition.
		</p>
		{#if selfTestPassed !== null}
			<span class="inline-block mt-2 text-xs px-2 py-0.5 rounded-full {selfTestPassed ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}">
				Tax engine {selfTestPassed ? '✓ verified' : '✗ self-test failed'}
			</span>
		{/if}
	</header>

	<div class="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
		<!-- ── Left panel: Inputs ────────────────────────────────────────── -->
		<aside class="space-y-4">

			<!-- Client Profile -->
			<Card.Root>
				<Card.Header class="pb-3">
					<Card.Title class="text-base">Client Profile</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1.5">
							<Label for="age">Current Age</Label>
							<Input id="age" type="number" min="18" max="80"
								value={profile.currentAge}
								onchange={(e) => profile.currentAge = +e.currentTarget.value} />
						</div>
						<div class="space-y-1.5">
							<Label for="retirement-age">Retirement Age</Label>
							<Input id="retirement-age" type="number" min="50" max="80"
								value={profile.retirementAge}
								onchange={(e) => profile.retirementAge = +e.currentTarget.value} />
						</div>
					</div>

					<div class="space-y-1.5">
						<Label for="salary">Gross Salary</Label>
						<div class="relative">
							<span class="absolute left-3 top-2.5 text-muted-foreground text-sm">£</span>
							<Input id="salary" type="number" class="pl-6"
								value={profile.salary}
								onchange={(e) => profile.salary = +e.currentTarget.value} />
						</div>
					</div>

					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1.5">
							<Label for="employer-contrib">Employer Pension %</Label>
							<Input id="employer-contrib" type="number" min="0" max="30" step="0.5"
								value={profile.employerContributionPct}
								onchange={(e) => profile.employerContributionPct = +e.currentTarget.value} />
						</div>
						<div class="space-y-1.5">
							<Label for="employee-contrib">Employee Pension %</Label>
							<Input id="employee-contrib" type="number" min="0" max="30" step="0.5"
								value={profile.employeeContributionPct}
								onchange={(e) => profile.employeeContributionPct = +e.currentTarget.value} />
						</div>
					</div>

					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1.5">
							<Label for="pension-pot">Current Pension Pot</Label>
							<div class="relative">
								<span class="absolute left-3 top-2.5 text-muted-foreground text-sm">£</span>
								<Input id="pension-pot" type="number" class="pl-6"
									value={profile.currentPensionPot}
									onchange={(e) => profile.currentPensionPot = +e.currentTarget.value} />
							</div>
						</div>
						<div class="space-y-1.5">
							<Label for="isa-balance">Current ISA Balance</Label>
							<div class="relative">
								<span class="absolute left-3 top-2.5 text-muted-foreground text-sm">£</span>
								<Input id="isa-balance" type="number" class="pl-6"
									value={profile.currentISABalance}
									onchange={(e) => profile.currentISABalance = +e.currentTarget.value} />
							</div>
						</div>
					</div>

					<div class="space-y-1.5">
						<Label for="spending">Retirement Spending Target (today's £)</Label>
						<div class="relative">
							<span class="absolute left-3 top-2.5 text-muted-foreground text-sm">£</span>
							<Input id="spending" type="number" class="pl-6"
								value={profile.retirementSpending}
								onchange={(e) => profile.retirementSpending = +e.currentTarget.value} />
						</div>
						<p class="text-xs text-muted-foreground">The "number" — what does a good retirement cost?</p>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Scenario Slider -->
			<Card.Root>
				<Card.Header class="pb-3">
					<Card.Title class="text-base">Retirement Age Scenario</Card.Title>
					<Card.Description class="text-xs">Drag to see impact live</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-3">
					<div class="flex items-center justify-between text-sm">
						<span class="text-muted-foreground">Age</span>
						<span class="font-bold text-2xl tabular-nums">{profile.retirementAge}</span>
					</div>
					<Slider
						min={50}
						max={75}
						step={1}
						value={[profile.retirementAge]}
						onValueChange={(v) => (profile.retirementAge = v[0])}
						class="w-full"
					/>
					<div class="flex justify-between text-xs text-muted-foreground">
						<span>50</span><span>75</span>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Assumptions -->
			<Card.Root>
				<Card.Header class="pb-3">
					<Card.Title class="text-base">Assumptions</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-3">
					<div class="grid grid-cols-3 gap-2">
						<div class="space-y-1">
							<Label class="text-xs">Salary Growth</Label>
							<div class="flex items-center gap-1">
								<Input type="number" step="0.1" min="0" max="10"
									value={(profile.salaryGrowthRate * 100).toFixed(1)}
									onchange={(e) => profile.salaryGrowthRate = +e.currentTarget.value / 100}
									class="text-sm" />
								<span class="text-muted-foreground text-xs">%</span>
							</div>
						</div>
						<div class="space-y-1">
							<Label class="text-xs">Investment Growth</Label>
							<div class="flex items-center gap-1">
								<Input type="number" step="0.1" min="0" max="15"
									value={(profile.investmentGrowthRate * 100).toFixed(1)}
									onchange={(e) => profile.investmentGrowthRate = +e.currentTarget.value / 100}
									class="text-sm" />
								<span class="text-muted-foreground text-xs">%</span>
							</div>
						</div>
						<div class="space-y-1">
							<Label class="text-xs">Inflation</Label>
							<div class="flex items-center gap-1">
								<Input type="number" step="0.1" min="0" max="10"
									value={(profile.inflationRate * 100).toFixed(1)}
									onchange={(e) => profile.inflationRate = +e.currentTarget.value / 100}
									class="text-sm" />
								<span class="text-muted-foreground text-xs">%</span>
							</div>
						</div>
					</div>
					<p class="text-xs text-muted-foreground">
						State Pension: {fmt(11_973)}/yr from age 67 (full new State Pension 2025/26)
					</p>
				</Card.Content>
			</Card.Root>

			<!-- Tax Breakdown for current salary -->
			<Card.Root>
				<Card.Header class="pb-3">
					<Card.Title class="text-base">Current Year Tax Breakdown</Card.Title>
					<Card.Description class="text-xs">2025/26 rates — England/Wales/NI</Card.Description>
				</Card.Header>
				<Card.Content>
					<dl class="space-y-2 text-sm">
						<div class="flex justify-between">
							<dt class="text-muted-foreground">Gross salary</dt>
							<dd class="font-mono">{fmt(taxBreakdown.grossIncome)}</dd>
						</div>
						<div class="flex justify-between">
							<dt class="text-muted-foreground">Personal Allowance</dt>
							<dd class="font-mono">{fmt(taxBreakdown.personalAllowance)}</dd>
						</div>
						<div class="border-t border-border pt-2 flex justify-between">
							<dt class="text-muted-foreground">Basic rate tax (20%)</dt>
							<dd class="font-mono text-orange-600 dark:text-orange-400">−{fmt(taxBreakdown.incomeTax.basicRateTax)}</dd>
						</div>
						{#if taxBreakdown.incomeTax.higherRateTax > 0}
						<div class="flex justify-between">
							<dt class="text-muted-foreground">Higher rate tax (40%)</dt>
							<dd class="font-mono text-red-600 dark:text-red-400">−{fmt(taxBreakdown.incomeTax.higherRateTax)}</dd>
						</div>
						{/if}
						{#if taxBreakdown.incomeTax.additionalRateTax > 0}
						<div class="flex justify-between">
							<dt class="text-muted-foreground">Additional rate tax (45%)</dt>
							<dd class="font-mono text-red-700 dark:text-red-600">−{fmt(taxBreakdown.incomeTax.additionalRateTax)}</dd>
						</div>
						{/if}
						<div class="flex justify-between">
							<dt class="text-muted-foreground">NI main (8%)</dt>
							<dd class="font-mono text-orange-600 dark:text-orange-400">−{fmt(taxBreakdown.ni.mainRateNI)}</dd>
						</div>
						{#if taxBreakdown.ni.upperRateNI > 0}
						<div class="flex justify-between">
							<dt class="text-muted-foreground">NI upper (2%)</dt>
							<dd class="font-mono text-orange-600 dark:text-orange-400">−{fmt(taxBreakdown.ni.upperRateNI)}</dd>
						</div>
						{/if}
						<div class="border-t border-border pt-2 flex justify-between font-semibold">
							<dt>Net take-home</dt>
							<dd class="font-mono text-green-600 dark:text-green-400">{fmt(taxBreakdown.takeHome)}</dd>
						</div>
						<div class="flex justify-between text-xs">
							<dt class="text-muted-foreground">Effective tax rate</dt>
							<dd class="text-muted-foreground">{fmtPct(taxBreakdown.effectiveTaxRate)}</dd>
						</div>
					</dl>
				</Card.Content>
			</Card.Root>
		</aside>

		<!-- ── Right panel: Chart + Summary ─────────────────────────────── -->
		<section class="space-y-4">

			<!-- Traffic Light Outcome -->
			{#if outcome}
			<Card.Root class="border-{outcome.trafficLight === 'green' ? 'green' : outcome.trafficLight === 'amber' ? 'yellow' : 'red'}-800">
				<Card.Content class="pt-4">
					<div class="flex items-center gap-4">
						<span class="text-5xl" role="img" aria-label="status">
							{#if outcome.trafficLight === 'green'}🟢
							{:else if outcome.trafficLight === 'amber'}🟡
							{:else}🔴{/if}
						</span>
						<div>
							<p class="font-semibold text-lg">{outcome.summary}</p>
							<p class="text-sm text-muted-foreground">
								Retirement at {profile.retirementAge} ·
								{outcome.moneyRunsOutAge === null
									? `${fmt(outcome.finalWealth)} left at 100`
									: `Shortfall from age ${outcome.moneyRunsOutAge}`}
							</p>
						</div>
					</div>
				</Card.Content>
			</Card.Root>
			{/if}

			<!-- Chart -->
			<Card.Root>
				<Card.Header class="pb-2">
					<Card.Title class="text-base">Cashflow Projection — Age {profile.currentAge} to 100</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="h-72 sm:h-96">
						<canvas bind:this={chartCanvas}></canvas>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Key Milestone Stats -->
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
				{#each [
					{ label: 'At Retirement', value: fmt(years.find(y => y.age === profile.retirementAge)?.totalWealth ?? 0) },
					{ label: 'Peak Wealth', value: fmt(Math.max(...years.map(y => y.totalWealth))) },
					{ label: 'At Age 80', value: fmt(years.find(y => y.age === 80)?.totalWealth ?? 0) },
					{ label: 'At Age 100', value: fmt(years.find(y => y.age === 100)?.totalWealth ?? 0) },
				] as stat}
				<Card.Root class="bg-card/50">
					<Card.Content class="pt-4 pb-3">
						<p class="text-xs text-muted-foreground">{stat.label}</p>
						<p class="font-bold text-lg tabular-nums">{stat.value}</p>
					</Card.Content>
				</Card.Root>
				{/each}
			</div>

			<!-- Year-by-year table (collapsible) -->
			<Card.Root>
				<Card.Header class="pb-3">
					<Card.Title class="text-base">Year-by-Year Detail</Card.Title>
				</Card.Header>
				<Card.Content class="p-0">
					<div class="overflow-x-auto">
						<table class="w-full text-xs">
							<thead>
								<tr class="border-b border-border">
									<th class="px-3 py-2 text-left text-muted-foreground font-medium">Age</th>
									<th class="px-3 py-2 text-right text-muted-foreground font-medium">Phase</th>
									<th class="px-3 py-2 text-right text-muted-foreground font-medium">Income</th>
									<th class="px-3 py-2 text-right text-muted-foreground font-medium">Tax+NI</th>
									<th class="px-3 py-2 text-right text-muted-foreground font-medium">Spending</th>
									<th class="px-3 py-2 text-right text-muted-foreground font-medium">Surplus</th>
									<th class="px-3 py-2 text-right text-muted-foreground font-medium">Pension Pot</th>
									<th class="px-3 py-2 text-right text-muted-foreground font-medium">ISA Pot</th>
								</tr>
							</thead>
							<tbody>
								{#each years.filter((_, i) => i % 1 === 0) as y}
								<tr class="border-b border-border/40 hover:bg-muted/30 transition-colors
									{y.surplus < 0 ? 'text-red-500 dark:text-red-400' : ''}
									{y.age === profile.retirementAge ? 'bg-blue-100/60 dark:bg-blue-900/20 font-semibold' : ''}
									{y.age === STATE_PENSION_AGE ? 'bg-green-100/60 dark:bg-green-900/20' : ''}">
									<td class="px-3 py-1.5 tabular-nums">{y.age}</td>
									<td class="px-3 py-1.5 text-right">
										{#if y.age === profile.retirementAge}
											<span class="text-blue-600 dark:text-blue-400">🎯 Retire</span>
										{:else if y.age === 67 && y.isRetired}
											<span class="text-green-600 dark:text-green-400">🏛️ SP</span>
										{:else if y.isWorking}
											<span class="text-muted-foreground">Work</span>
										{:else}
											<span class="text-muted-foreground">Ret.</span>
										{/if}
									</td>
									<td class="px-3 py-1.5 text-right tabular-nums">{fmt(y.totalIncome)}</td>
									<td class="px-3 py-1.5 text-right tabular-nums text-orange-600 dark:text-orange-400">
										{y.incomeTax + y.employeeNI > 0 ? fmt(y.incomeTax + y.employeeNI) : '—'}
									</td>
									<td class="px-3 py-1.5 text-right tabular-nums">{fmt(y.spending)}</td>
									<td class="px-3 py-1.5 text-right tabular-nums {y.surplus >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
										{y.surplus >= 0 ? '+' : ''}{fmt(y.surplus)}
									</td>
									<td class="px-3 py-1.5 text-right tabular-nums">{fmt(y.pensionPot)}</td>
									<td class="px-3 py-1.5 text-right tabular-nums">{fmt(y.isaPot)}</td>
								</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Educational notes -->
			<Card.Root class="bg-muted/20">
				<Card.Header class="pb-2">
					<Card.Title class="text-sm">💡 How It Works</Card.Title>
				</Card.Header>
				<Card.Content class="text-xs text-muted-foreground space-y-1.5">
					<p><strong class="text-foreground">Working years:</strong> Pension grows via employer + employee contributions + investment growth. ISA receives surplus take-home after spending.</p>
					<p><strong class="text-foreground">At retirement:</strong> 25% tax-free lump sum taken (up to the £268,275 Lump Sum Allowance), moved to savings.</p>
					<p><strong class="text-foreground">Retirement income:</strong> ISA withdrawals first (tax-free), then State Pension from 67, then taxable pension drawdown to cover the rest.</p>
					<p><strong class="text-foreground">Tax:</strong> 2025/26 England/Wales/NI rates. Personal allowance tapers £1 per £2 above £100k, reaching zero at £125,140.</p>
				</Card.Content>
			</Card.Root>
		</section>
	</div>
</main>


