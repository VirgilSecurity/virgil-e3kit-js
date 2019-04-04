const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    mode: 'production',
    entry: path.resolve(__dirname, './index.js'),
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'dist'),
    },
    resolve: { symlinks: false,  modules: ['../node_modules'] },
    plugins: [
        new HtmlWebpackPlugin(),
    ],
    devServer: {
        contentBase: './dist/',
        port: 3003,
        hot: false
    }
};
