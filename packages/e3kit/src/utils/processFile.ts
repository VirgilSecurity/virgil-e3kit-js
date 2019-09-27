import { AbortError } from '@virgilsecurity/e3kit-base';

/**
 * @hidden
 */
export type onChunkCallback = (chunk: string | ArrayBuffer, offset: number) => void;

/**
 * @hidden
 */
export type processFileOptions = {
    file: Blob;
    chunkSize: number;
    signal?: AbortSignal;
    onChunkCallback: onChunkCallback;
    onFinishCallback: () => void;
    onErrorCallback: (err: any) => void;
};

/**
 * @hidden
 */
export function processFile({
    file,
    chunkSize,
    signal,
    onChunkCallback,
    onFinishCallback,
    onErrorCallback,
}: processFileOptions) {
    const reader = new FileReader();

    const dataSize = file.size;

    let offset = 0;
    let endOffset = Math.min(offset + chunkSize, dataSize);

    if (signal) {
        const onAbort = () => {
            reader.abort();
            onErrorCallback(new AbortError());
        };
        if (signal.aborted) return onAbort();
        else signal.addEventListener('abort', onAbort);
    }

    reader.onload = () => {
        if (!reader.result) throw new Error('reader.result is null');

        try {
            onChunkCallback(reader.result, endOffset);
        } catch (err) {
            return onErrorCallback(err);
        }

        offset = endOffset;
        endOffset = Math.min(offset + chunkSize, dataSize);

        if (offset === dataSize) {
            try {
                onFinishCallback();
            } catch (err) {
                onErrorCallback(err);
            }
        } else {
            reader.readAsArrayBuffer(file.slice(offset, endOffset));
        }
    };

    reader.onerror = () => onErrorCallback(reader.error);

    reader.readAsArrayBuffer(file.slice(offset, endOffset));
}
