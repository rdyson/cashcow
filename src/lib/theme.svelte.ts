import { browser } from '$app/environment';

const STORAGE_KEY = 'cashcow-theme';

function createThemeStore() {
	// isDark = true means data-theme="night", false means data-theme="corporate"
	let isDark = $state(false);

	return {
		get isDark() {
			return isDark;
		},

		/** Call once from layout onMount to hydrate from localStorage */
		init() {
			if (!browser) return;
			const stored = localStorage.getItem(STORAGE_KEY);
			isDark = stored === 'night';
			this.apply();
		},

		toggle() {
			isDark = !isDark;
			if (browser) {
				localStorage.setItem(STORAGE_KEY, isDark ? "night" : "corporate");
				this.apply();
			}
		},

		apply() {
			if (!browser) return;
			document.documentElement.setAttribute('data-theme', isDark ? "night" : "corporate");
		},
	};
}

export const theme = createThemeStore();
