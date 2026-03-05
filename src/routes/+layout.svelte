<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>CashCow — UK Cashflow Modeller</title>
</svelte:head>

<div class="dark min-h-screen bg-background text-foreground">
	{@render children()}
</div>
