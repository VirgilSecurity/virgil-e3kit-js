if (!Object.values) {
    Object.values = function(obj: { [x: string]: any }) {
        return Object.keys(obj).map(function(e) {
            return obj[e];
        });
    };
}
