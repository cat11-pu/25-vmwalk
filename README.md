# vmwalk

虚拟地址下钻台（原生 ES 模块，零依赖）：页号从高位按每级索引位数切段，逐级下钻去查稀疏多级表，
命中就走 TLB、查不到就记页故障；表按路径稀疏存放，空表从叶往上裁，帧按最小空闲号分配。

## 起服务看页面

    python3 -m http.server 8000

浏览器打开 http://127.0.0.1:8000/ 即可操作：上面是地址解剖尺与下钻节拍，中间是逐级表，
下面是 TLB 槽带、帧分配与访问流水，底部一排按钮加事件。

## 要补的文件

    ptable.js   vpnOf / indicesOf / entryPathOf
    ops.js      map / unmap / access / flush

app.js、audit.js、check_sample.js、tests/run.js 与页面都已写好，只调不写。

## 测试

    node tests/run.js

## 场景自检

    node check_sample.js
