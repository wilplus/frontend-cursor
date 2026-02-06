/**
 * AudioWorkletProcessor: buffers 250ms of mono float32 at context sample rate,
 * then posts to main thread for resampling and upload.
 * Main thread resamples to 16 kHz and sends PCM16LE chunks.
 */
class PCMChunkProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    const sampleRate = options.processorOptions?.sampleRate ?? 48000;
    this.chunkSamples = Math.floor(0.25 * sampleRate); // 250 ms
    this.buffer = new Float32Array(this.chunkSamples);
    this.offset = 0;
  }

  process(inputs, _outputs, _params) {
    const input = inputs[0];
    if (!input || !input.length) return true;

    const channel = input[0];
    if (!channel) return true;

    const toCopy = Math.min(channel.length, this.chunkSamples - this.offset);
    this.buffer.set(channel.subarray(0, toCopy), this.offset);
    this.offset += toCopy;

    if (this.offset >= this.chunkSamples) {
      const slice = this.buffer.slice(0, this.chunkSamples);
      this.port.postMessage(slice.buffer, [slice.buffer]);
      this.offset = 0;
    }

    if (channel.length > toCopy) {
      this.buffer.set(channel.subarray(toCopy, channel.length), 0);
      this.offset = channel.length - toCopy;
    }

    return true;
  }
}

registerProcessor("pcm-chunk-processor", PCMChunkProcessor);
