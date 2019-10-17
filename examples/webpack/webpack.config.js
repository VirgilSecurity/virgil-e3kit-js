const path = require('path');

const dotenv = require('dotenv');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { DefinePlugin } = require('webpack');

const DEFAULT_API_URL = 'http://localhost:8080';

dotenv.config();

module.exports = {
    mode: 'development',
    entry: path.join(__dirname, 'index.js'),
    module: {
        rules: [
            {
                test: /\.wasm$/,
                type: 'javascript/auto',
                loader: 'file-loader',
                options: { name: '[name].[ext]' },
            },
        ],
    },
    plugins: [
        new DefinePlugin({
            'process.env.API_URL': JSON.stringify(process.env.API_URL || DEFAULT_API_URL),
            'process.env.VIRGIL_API_URL': JSON.stringify(process.env.VIRGIL_API_URL),
        }),
        new HtmlWebpackPlugin({ template: path.join(__dirname, 'index.html') }),
    ],
};
