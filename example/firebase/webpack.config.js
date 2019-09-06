const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Visualizer = require('webpack-visualizer-plugin');

module.exports = {
    mode: 'production',
    entry: path.resolve(__dirname, './index.js'),
    devtool: 'cheap-module-source-map',
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'dist'),
    },
    resolve: { symlinks: false,  modules: ['./node_modules'] },
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
        }),
        new Visualizer(),
    ],
    optimization: {
        minimize: false,
    },
    devServer: {
        contentBase: './dist/',
        port: 3003,
        hot: false
    }
};
