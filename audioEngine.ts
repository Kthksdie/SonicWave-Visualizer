
/**
 * Shared Audio Engine Singleton
 * Manages a single AudioContext and caches MediaElementSourceNodes.
 * This prevents the InvalidStateError when multiple components try to capture
 * the same HTMLMediaElement.
 */

class AudioEngine {
  private context: AudioContext | null = null;
  // Fixed typo: replaced the non-existent MediaElementSourceNode with the correct MediaElementAudioSourceNode type.
  private sourceNodes = new Map<HTMLMediaElement, MediaElementAudioSourceNode>();

  public getContext(): AudioContext {
    if (!this.context || this.context.state === 'closed') {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.context;
  }

  public getOrCreateSourceNode(source: MediaStream | HTMLMediaElement): AudioNode {
    const ctx = this.getContext();
    
    if (source instanceof MediaStream) {
      // MediaStreamSourceNodes can generally be created multiple times per stream
      // but they are light. For consistency we could cache, but stream nodes
      // are usually tied to specific component lifecycles.
      return ctx.createMediaStreamSource(source);
    }

    // HTMLMediaElement singleton requirement:
    if (this.sourceNodes.has(source)) {
      return this.sourceNodes.get(source)!;
    }

    const node = ctx.createMediaElementSource(source);
    // Standard practice: connect to destination immediately so it still plays audio
    node.connect(ctx.destination);
    this.sourceNodes.set(source, node);
    return node;
  }

  public async resume(): Promise<void> {
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume();
    }
  }
}

export const audioEngine = new AudioEngine();
