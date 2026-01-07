/**
 * AdManager - Handles Google AdSense interstitial ads
 * Shows an ad every N deaths during the game over screen
 */

import { SaveManager } from '../systems/SaveManager';

const AD_FREQUENCY = 5; // Show ad every 5 deaths

declare global {
    interface Window {
        adsbygoogle?: Array<Record<string, unknown>>;
    }
}

export class AdManager {
    private static instance: AdManager | null = null;
    private adSlotId: string = 'ad-interstitial';
    private isAdReady: boolean = false;

    private constructor() {
        this.initializeAds();
    }

    static getInstance(): AdManager {
        if (!AdManager.instance) {
            AdManager.instance = new AdManager();
        }
        return AdManager.instance;
    }

    /**
     * Initialize AdSense (called once on page load)
     */
    private initializeAds(): void {
        // Check if AdSense script is loaded
        if (typeof window.adsbygoogle !== 'undefined') {
            this.isAdReady = true;
            console.log('[AdManager] AdSense initialized');
        } else {
            console.log('[AdManager] AdSense not loaded - ads will be skipped');
        }
    }

    /**
     * Increment death counter and return new count
     */
    incrementDeaths(): number {
        const save = SaveManager.getCurrent();
        const newCount = (save.deathCount || 0) + 1;
        SaveManager.update({ deathCount: newCount });
        SaveManager.save(SaveManager.getCurrent());
        return newCount;
    }

    /**
     * Get current death count
     */
    getDeathCount(): number {
        return SaveManager.getCurrent().deathCount || 0;
    }

    /**
     * Check if we should show an ad (every Nth death)
     */
    shouldShowAd(): boolean {
        const deathCount = this.getDeathCount();
        return deathCount > 0 && deathCount % AD_FREQUENCY === 0;
    }

    /**
     * Show interstitial ad
     * Returns a Promise that resolves when ad is closed or fails
     */
    async showInterstitialAd(): Promise<void> {
        if (!this.isAdReady) {
            console.log('[AdManager] Skipping ad - AdSense not ready');
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            try {
                // Create ad container
                const adContainer = document.createElement('div');
                adContainer.id = this.adSlotId;
                adContainer.className = 'ad-interstitial-backdrop';
                adContainer.innerHTML = `
                    <div class="ad-interstitial-container">
                        <p class="ad-label">Advertisement</p>
                        <ins class="adsbygoogle"
                             style="display:block; width:336px; height:280px;"
                             data-ad-client="ca-pub-1942074246140873"
                             data-ad-slot="5430518471"
                             data-ad-format="rectangle"
                             data-full-width-responsive="false"></ins>
                        <button id="ad-close-btn" class="ad-close-btn">Continue (5s)</button>
                    </div>
                `;

                document.body.appendChild(adContainer);

                // Push ad to AdSense
                try {
                    (window.adsbygoogle = window.adsbygoogle || []).push({});
                } catch (e) {
                    console.warn('[AdManager] AdSense push failed:', e);
                }

                // Countdown for close button
                let countdown = 5;
                const closeBtn = document.getElementById('ad-close-btn') as HTMLButtonElement;
                if (closeBtn) {
                    closeBtn.disabled = true;
                    const interval = setInterval(() => {
                        countdown--;
                        if (countdown <= 0) {
                            clearInterval(interval);
                            closeBtn.disabled = false;
                            closeBtn.textContent = 'Continue';
                        } else {
                            closeBtn.textContent = `Continue (${countdown}s)`;
                        }
                    }, 1000);
                }

                // Close handler
                const closeAd = () => {
                    adContainer.remove();
                    resolve();
                };

                document.getElementById('ad-close-btn')?.addEventListener('click', () => {
                    if (!closeBtn?.disabled) {
                        closeAd();
                    }
                });

                // Fallback timeout (30 seconds max)
                setTimeout(closeAd, 30000);

            } catch (e) {
                console.error('[AdManager] Failed to show ad:', e);
                resolve();
            }
        });
    }
}
