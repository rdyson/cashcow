import { browser } from '$app/environment';

const STORAGE_KEY = 'cashcow-theme';

function createThemeStore() {
	// isDark = true means data-theme="dark", false means data-theme="luxury"
	let isDark = $state(false);

	return {
		get isDark() {
			return isDark;
		},

		/** Call once from layout onMount to hydrate from localStorage */
		init() {
			if (!browser) return;
			const stored = localStorage.getItem(STORAGE_KEY);
			isDark = stored === 'dark';
			this.apply();
		},

		toggle() {
			isDark = !isDark;
			if (browser) {
				localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'luxury');
				this.apply();
			}
		},

		apply() {
			if (!browser) return;
			document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'luxury');
		},
	};
}

export const theme = createThemeStore();
