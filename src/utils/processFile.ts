import { onProgressCallback } from '../EThree';

export function processFile(
    data: Blob,
    chunkSize: number,
    onChunkCallback: (chunk: string | ArrayBuffer) => void,
    onFinishCallback: () => void,
    onErrorCallback: (err: any) => void,
    onProgress?: onProgressCallback,
) {
    const reader = new FileReader();

    const dataSize = data.size;

    let offset = 0;
    let endOffset = Math.min(offset + chunkSize, dataSize);

    reader.onload = () => {
        if (!reader.result) throw new Error('something wrong');

        try {
            onChunkCallback(reader.result);
        } catch (err) {
            return onErrorCallback(err);
        }

        if (onProgress) {
            try {
                onProgress({ fileSize: dataSize, bytesProcessed: endOffset });
            } catch (err) {
                return onErrorCallback(err);
            }
        }

        offset = endOffset;
        endOffset = Math.min(offset + chunkSize, dataSize);

        if (offset === dataSize) {
            try {
                onFinishCallback();
            } catch (err) {
                return onErrorCallback(err);
            }
        } else {
            reader.readAsArrayBuffer(data.slice(offset, endOffset));
        }
    };
    reader.onerror = () => onErrorCallback(reader.error);

    reader.readAsArrayBuffer(data);
}
