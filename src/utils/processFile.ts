export type onChunkCallback = (chunk: string | ArrayBuffer, offset: number) => void;

export function processFile(
    data: Blob,
    chunkSize: number,
    onChunkCallback: onChunkCallback,
    onFinishCallback: () => void,
    onErrorCallback: (err: any) => void,
) {
    const reader = new FileReader();

    const dataSize = data.size;

    let offset = 0;
    let endOffset = Math.min(offset + chunkSize, dataSize);
    console.log('processFile', endOffset, dataSize);

    reader.onload = () => {
        if (!reader.result) throw new Error('something wrong');

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
                return onErrorCallback(err);
            }
        } else {
            reader.readAsArrayBuffer(data.slice(offset, endOffset));
        }
    };
    reader.onerror = () => onErrorCallback(reader.error);

    reader.readAsArrayBuffer(data);
}
