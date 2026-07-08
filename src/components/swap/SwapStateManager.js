// SwapStateManager - Handles all swap state persistence to filesystem

const STORAGE_KEYS = {
  ACTIVE_SWAP: 'active_swap',
  SWAP_PROGRESS: 'swap_progress',
  USER_SELECTIONS: 'user_selections',
};

export const SwapStateManager = {
  // Swap Configuration Management
  async saveSwapConfig(swapConfig) {
    const swapData = {
      ...swapConfig,
      status: 'configured',
      createdAt: Date.now(),
    };

    const state = await this.loadState();
    state[STORAGE_KEYS.ACTIVE_SWAP] = swapData;
    delete state[STORAGE_KEYS.SWAP_PROGRESS];
    await this.saveState(state);

    console.log('Swap config saved:', swapData);
  },

  async getActiveSwap() {
    try {
      const state = await this.loadState();
      return state[STORAGE_KEYS.ACTIVE_SWAP] || null;
    } catch (error) {
      console.error('Error getting active swap:', error);
      return null;
    }
  },

  async hasActiveSwap() {
    const activeSwap = await this.getActiveSwap();
    if (!activeSwap) return false;

    const isActive =
      activeSwap.status === 'in_progress' || activeSwap.status === 'configured';

    // Check if configured swap is stale
    if (activeSwap.status === 'configured') {
      const age = Date.now() - activeSwap.createdAt;
      if (age > 15 * 60 * 1000) {
        console.log(
          '🧹 Clearing stale configured swap from hasActiveSwap check'
        );
        await this.clearSwapData();
        return false;
      }
    }

    return isActive;
  },

  // Swap Progress Management
  async saveSwapProgress(progressData) {
    const state = await this.loadState();
    const activeSwap = state[STORAGE_KEYS.ACTIVE_SWAP];
    const scopedProgress = { ...progressData };

    if (activeSwap?.swapId && !scopedProgress.swapId) {
      scopedProgress.swapId = activeSwap.swapId;
    }
    if (activeSwap?.nativeSwapId && !scopedProgress.nativeSwapId) {
      scopedProgress.nativeSwapId = activeSwap.nativeSwapId;
    }

    if (
      scopedProgress.swapId &&
      activeSwap?.swapId &&
      scopedProgress.swapId !== activeSwap.swapId
    ) {
      const error = new Error('Swap progress swapId does not match active swap');
      console.error('Refusing to save swap progress:', error.message);
      throw error;
    }

    if (
      scopedProgress.nativeSwapId &&
      activeSwap?.nativeSwapId &&
      scopedProgress.nativeSwapId !== activeSwap.nativeSwapId
    ) {
      const error = new Error(
        'Swap progress nativeSwapId does not match active swap'
      );
      console.error('Refusing to save swap progress:', error.message);
      throw error;
    }

    state[STORAGE_KEYS.SWAP_PROGRESS] = scopedProgress;

    console.log('Swap progress saved:', {
      status: scopedProgress.status || 'in_progress',
      currentStep: scopedProgress.currentStep,
      logCount: Array.isArray(scopedProgress.logMessages)
        ? scopedProgress.logMessages.length
        : 0,
    });

    // Also update the active swap status
    if (activeSwap) {
      activeSwap.status = scopedProgress.status || 'in_progress';
      activeSwap.currentStep = scopedProgress.currentStep;
      activeSwap.lastUpdated = Date.now();
      state[STORAGE_KEYS.ACTIVE_SWAP] = activeSwap;
    }

    await this.saveState(state);
  },

  async getSwapProgress() {
    try {
      const state = await this.loadState();
      return state[STORAGE_KEYS.SWAP_PROGRESS] || null;
    } catch (error) {
      console.error('Error getting swap progress:', error);
      return null;
    }
  },

  // User Selections Management
  async saveUserSelections(selections) {
    const state = await this.loadState();
    state[STORAGE_KEYS.USER_SELECTIONS] = selections;
    await this.saveState(state);

    console.log('User selections saved:', selections);
  },

  async getUserSelections() {
    try {
      const state = await this.loadState();
      return state[STORAGE_KEYS.USER_SELECTIONS] || null;
    } catch (error) {
      console.error('Error getting user selections:', error);
      return null;
    }
  },

  // Swap Completion
  async completeSwap() {
    const state = await this.loadState();

    delete state[STORAGE_KEYS.ACTIVE_SWAP];
    delete state[STORAGE_KEYS.SWAP_PROGRESS];

    await this.saveState(state);
    console.log('Swap marked as completed and cleared from active state');
  },

  // Clear all swap data
  async clearSwapData() {
    const state = await this.loadState();
    delete state[STORAGE_KEYS.ACTIVE_SWAP];
    delete state[STORAGE_KEYS.SWAP_PROGRESS];
    delete state[STORAGE_KEYS.USER_SELECTIONS];
    await this.saveState(state);

    console.log('Swap data cleared');
  },

  // Get elapsed time for active swap
  async getElapsedTime() {
    const progress = await this.getSwapProgress();
    if (!progress || !progress.startTime) return 0;
    return Math.max(0, Date.now() - progress.startTime);
  },

  async loadState() {
    try {
      const result = await window.api.swapState.load();
      if (result.success && result.state) {
        return result.state;
      }
      return {};
    } catch (error) {
      console.error('Failed to load state:', error);
      return {};
    }
  },

  async saveState(state) {
    try {
      await window.api.swapState.save(state);
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  },
};
