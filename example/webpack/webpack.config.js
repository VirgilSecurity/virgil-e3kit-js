const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    mode: 'production',
    entry: path.resolve(__dirname, './index.js'),
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            {
                test: /\.wasm$/,
                type: 'javascript/auto',
                loader: 'file-loader',
                options: {
                  name: '[name].[ext]'
                }
            }
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            inject: true,
            template: path.resolve(__dirname, './index.html'),
        })
    ],
    optimization: {
        minimize: false,
    },
    devServer: {
        contentBase: './dist/',
        port: 3004,
        hot: false
    }
};
