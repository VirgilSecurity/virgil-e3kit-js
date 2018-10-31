const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    mode: 'development',
    entry: path.resolve(__dirname, './index.js'),
    devtool: 'cheap-module-source-map',
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'dist'),
    },
    plugins: [
        new HtmlWebpackPlugin({
            inject: true,
            template: path.resolve(__dirname, './index.html'),
        }),
    ],
    devServer: {
        contentBase: './dist/',
        port: 3003,
        hot: false
    }
};
