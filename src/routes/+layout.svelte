<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import { theme } from '$lib/theme.svelte';

	let { children } = $props();

	onMount(() => {
		theme.init();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>CashCow — UK Cashflow Modeller</title>
</svelte:head>

<!-- Theme toggle floats top-right on all pages -->
<div class="fixed top-4 right-4 z-50">
	<button
		onclick={() => theme.toggle()}
		class="flex items-center justify-center w-9 h-9 rounded-full border border-border bg-card text-foreground shadow-md hover:bg-muted transition-colors duration-200"
		aria-label={theme.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
		title={theme.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
	>
		{#if theme.isDark}
			<!-- Sun icon -->
			<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="4"/>
				<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
			</svg>
		{:else}
			<!-- Moon icon -->
			<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
			</svg>
		{/if}
	</button>
</div>

<div class="min-h-screen bg-background text-foreground">
	{@render children()}
</div>
