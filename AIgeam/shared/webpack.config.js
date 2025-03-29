const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    mode: 'production',
    entry: {
        // 经典游戏
        tetris: './games/classic/tetris/index.js',
        minesweeper: './games/classic/minesweeper/index.js',
        breakout: './games/classic/breakout/index.js',
        flappybird: './games/classic/flappybird/index.js',
        spaceinvaders: './games/classic/spaceinvaders/index.js',
        
        // 益智类
        mahjong: './games/puzzle/mahjong/index.js',
        sokoban: './games/puzzle/sokoban/index.js',
        klotski: './games/puzzle/klotski/index.js',
        jigsaw: './games/puzzle/jigsaw/index.js',
        
        // 多人/联机类
        gomoku: './games/multiplayer/gomoku/index.js',
        tictactoe: './games/multiplayer/tictactoe/index.js',
        slitherio: './games/multiplayer/slitherio/index.js',
        pong: './games/multiplayer/pong/index.js',
        
        // 现代流行
        tower: './games/modern/tower/index.js',
        candy: './games/modern/candy/index.js',
        jump: './games/modern/jump/index.js',
        bubble: './games/modern/bubble/index.js',
        
        // 创新实验性
        procmaze: './games/experimental/procmaze/index.js',
        tankai: './games/experimental/tankai/index.js',
        sandbox: './games/experimental/sandbox/index.js',
        textadv: './games/experimental/textadv/index.js',
        rhythm: './games/experimental/rhythm/index.js',
        
        // 共享资源
        common: './games/common/utils/index.js'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name]/[name].bundle.js',
        clean: true
    },
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin({
            terserOptions: {
                format: {
                    comments: false,
                },
                compress: {
                    drop_console: true,
                },
            },
            extractComments: false,
        })],
        splitChunks: {
            chunks: 'all',
            name: 'vendor'
        }
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\.(png|svg|jpg|jpeg|gif)$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'assets/[hash][ext][query]'
                }
            },
            {
                test: /\.(woff|woff2|eot|ttf|otf)$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'fonts/[hash][ext][query]'
                }
            },
            {
                test: /\.wat$/,
                type: 'asset/resource',
                generator: {
                    filename: 'wasm/[hash][ext][query]'
                }
            },
            {
                test: /\.(mp3|wav|ogg)$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'audio/[hash][ext][query]'
                }
            }
        ]
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                { 
                    from: 'index.html',
                    to: '' 
                },
                {
                    from: 'games/common/assets',
                    to: 'assets'
                }
            ]
        }),
        ...Object.keys(module.exports.entry).map(name => 
            new HtmlWebpackPlugin({
                template: `./games/${name}/index.html`,
                filename: `${name}/index.html`,
                chunks: [name],
                title: `AIgeam - ${name.charAt(0).toUpperCase() + name.slice(1)}`
            })
        )
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            '@common': path.resolve(__dirname, 'games/common'),
            '@classic': path.resolve(__dirname, 'games/classic'),
            '@puzzle': path.resolve(__dirname, 'games/puzzle'),
            '@multiplayer': path.resolve(__dirname, 'games/multiplayer'),
            '@modern': path.resolve(__dirname, 'games/modern'),
            '@experimental': path.resolve(__dirname, 'games/experimental')
        }
    },
    performance: {
        hints: false
    },
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'),
        },
        compress: true,
        port: 9000,
        hot: true,
        open: true
    }
}; 