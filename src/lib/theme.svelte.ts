import { browser } from '$app/environment';

const STORAGE_KEY = 'cashcow-theme';

function createThemeStore() {
	let isDark = $state(true);

	return {
		get isDark() {
			return isDark;
		},

		/** Call once from layout onMount to hydrate from localStorage */
		init() {
			if (!browser) return;
			const stored = localStorage.getItem(STORAGE_KEY);
			isDark = stored !== null ? stored === 'dark' : true;
			this.apply();
		},

		toggle() {
			isDark = !isDark;
			if (browser) {
				localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
				this.apply();
			}
		},

		apply() {
			if (!browser) return;
			if (isDark) {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}
		},
	};
}

export const theme = createThemeStore();
