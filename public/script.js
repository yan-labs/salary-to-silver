/**
 * 几斤几两 | 俸禄换算 - 主逻辑脚本
 */

(function() {
    'use strict';

    // DOM 元素
    const elements = {
        silverPrice: document.getElementById('silverPrice'),
        priceNote: document.getElementById('priceNote'),
        salaryInput: document.getElementById('salaryInput'),
        calculateBtn: document.getElementById('calculateBtn'),
        resultSection: document.getElementById('resultSection'),
        silverLiang: document.getElementById('silverLiang'),
        silverQian: document.getElementById('silverQian'),
        silverGram: document.getElementById('silverGram'),
        rankSeal: document.getElementById('rankSeal'),
        rankText: document.getElementById('rankText'),
        rankTitle: document.getElementById('rankTitle'),
        rankPosition: document.getElementById('rankPosition'),
        rankDescription: document.getElementById('rankDescription'),
        formula: document.getElementById('formula'),
        rankTableBody: document.getElementById('rankTableBody')
    };

    // 状态
    let currentSilverPrice = DEFAULT_SILVER_PRICE;

    // 初始化
    function init() {
        fetchSilverPrice().then(() => {
            renderRankTable();
            updateFAQ();
        });
        bindEvents();
    }

    // 获取白银价格（实时）
    async function fetchSilverPrice() {
        elements.priceNote.textContent = '正在获取...';

        try {
            const response = await fetch('/api/silver-price');
            const data = await response.json();

            if (data && data.price) {
                currentSilverPrice = parseFloat(data.price);
                elements.silverPrice.textContent = currentSilverPrice.toFixed(2);
                elements.priceNote.textContent = data.error ? '参考价格' : `来源: ${data.source}`;
            } else {
                throw new Error('Invalid response');
            }
        } catch (error) {
            console.warn('获取银价失败，使用默认值:', error);
            useDefaultPrice();
        }
    }

    // 使用默认银价
    function useDefaultPrice() {
        currentSilverPrice = DEFAULT_SILVER_PRICE;
        elements.silverPrice.textContent = currentSilverPrice;
        elements.priceNote.textContent = '参考价格';
    }

    // 绑定事件
    function bindEvents() {
        elements.calculateBtn.addEventListener('click', handleCalculate);
        elements.salaryInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleCalculate();
            }
        });

        // 输入时移除错误状态
        elements.salaryInput.addEventListener('input', () => {
            elements.salaryInput.parentElement.classList.remove('error');
        });
    }

    // 处理计算
    function handleCalculate() {
        const salary = parseFloat(elements.salaryInput.value);

        if (!salary || salary < 0) {
            shakeInput();
            return;
        }

        // 计算白银重量（克）
        const silverGram = salary / currentSilverPrice;

        // 转换为两、钱
        const { liang, qian } = gramToLiangQian(silverGram);

        // 匹配官职
        const totalLiang = silverGram / CONVERSION.GRAM_PER_LIANG;
        const rank = matchRank(totalLiang);

        // 显示结果
        showResult({
            gram: silverGram.toFixed(2),
            liang,
            qian,
            rank,
            salary,
            price: currentSilverPrice
        });

        // 高亮对照表中的匹配行
        highlightTableRow(rank.grade);
    }

    // 输入框抖动效果
    function shakeInput() {
        const wrapper = elements.salaryInput.parentElement;
        wrapper.classList.add('error');
        wrapper.style.animation = 'shake 0.5s ease';

        setTimeout(() => {
            wrapper.style.animation = '';
        }, 500);
    }

    // 显示结果
    function showResult(data) {
        // 更新数值
        elements.silverGram.textContent = data.gram;
        elements.silverLiang.textContent = data.liang;
        elements.silverQian.textContent = data.qian;

        // 更新官职信息
        elements.rankText.textContent = data.rank.sealChar;
        elements.rankTitle.textContent = data.rank.grade;
        elements.rankPosition.textContent = data.rank.position;
        elements.rankDescription.textContent = data.rank.description;

        // 更新公式
        elements.formula.textContent = `${data.salary}元 ÷ ${data.price}元/克 = ${data.gram}克`;

        // 显示结果区域
        elements.resultSection.classList.remove('hidden');
        elements.resultSection.classList.add('animate-fadeUp');

        // 重新触发印章动画
        elements.rankSeal.classList.remove('animate-stamp');
        void elements.rankSeal.offsetWidth;
        elements.rankSeal.classList.add('animate-stamp');

        // 滚动到结果区域
        setTimeout(() => {
            elements.resultSection.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }, 100);
    }

    // 渲染俸禄对照表
    function renderRankTable() {
        const tbody = elements.rankTableBody;
        tbody.innerHTML = '';

        // 显示所有等级（包括平民等级）
        RANK_DATA.forEach(rank => {
            const modernSalary = (rank.monthlyLiang * CONVERSION.GRAM_PER_LIANG * currentSilverPrice).toFixed(0);

            const tr = document.createElement('tr');
            tr.dataset.grade = rank.grade;
            tr.innerHTML = `
                <td class="rank-grade">${rank.grade}</td>
                <td>${rank.position.split('、')[0]}</td>
                <td class="rank-salary">${rank.monthlyLiang}</td>
                <td>≈ ¥${Number(modernSalary).toLocaleString()}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 高亮表格行
    function highlightTableRow(grade) {
        // 移除所有高亮
        const rows = elements.rankTableBody.querySelectorAll('tr');
        rows.forEach(row => row.classList.remove('highlight'));

        // 添加新高亮
        const targetRow = elements.rankTableBody.querySelector(`tr[data-grade="${grade}"]`);
        if (targetRow) {
            targetRow.classList.add('highlight');

            // 滚动到可见区域
            setTimeout(() => {
                targetRow.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }, 800);
        }
    }

    // 更新 FAQ 中的动态数据
    function updateFAQ() {
        const price = currentSilverPrice;

        // 月薪1万换算
        const salary10k = 10000;
        const gram10k = salary10k / price;
        const liang10k = (gram10k / CONVERSION.GRAM_PER_LIANG).toFixed(1);
        const rank10k = matchRank(gram10k / CONVERSION.GRAM_PER_LIANG);

        // 正七品县令月俸折算
        const rank7 = RANK_DATA.find(r => r.grade === '正七品');
        const salary7 = (rank7.monthlyLiang * CONVERSION.GRAM_PER_LIANG * price).toFixed(0);

        // 更新 FAQ 内容
        const faq1 = document.getElementById('faq1-answer');
        const faq2 = document.getElementById('faq2-answer');
        const faq3 = document.getElementById('faq3-answer');
        const faq4 = document.getElementById('faq4-answer');

        if (faq1) {
            faq1.innerHTML = `按照当前白银价格（约${price.toFixed(1)}元/克）计算，<strong>月薪1万元约等于${liang10k}两白银</strong>。根据明朝俸禄制度，这相当于${rank10k.grade}${rank10k.position.split('、')[0]}的月俸（${rank10k.monthlyLiang}两），是「${rank10k.description.split('。')[0]}」。`;
        }

        if (faq2) {
            faq2.innerHTML = `根据明清标准，<strong>1两银子约等于37.3克</strong>。古代使用十六两制，即1斤=16两≈596.8克。换算公式：白银克数 = 月薪(元) ÷ 银价(元/克)。`;
        }

        if (faq3) {
            faq3.innerHTML = `明朝官员俸禄从<strong>正一品太师月俸87两</strong>，到<strong>从九品驿丞月俸5两</strong>不等。正七品县令月俸约7.5两，按现在银价折算约${Number(salary7).toLocaleString()}元。未入流小吏月俸约3两，平民农户约1-2两。`;
        }

        if (faq4) {
            const exampleGram = (10000 / price).toFixed(0);
            const exampleResult = gramToLiangQian(10000 / price);
            faq4.innerHTML = `换算公式为：<strong>白银克数 = 月薪(元) ÷ 当前银价(元/克)</strong>，然后转换为古制单位：1两=37.3克，1两=10钱。例如月薪10000元，银价${price.toFixed(1)}元/克，得到${exampleGram}克，约${exampleResult.liang}两${exampleResult.qian}钱白银。`;
        }

        // 更新简介
        const summary = document.getElementById('summary-text');
        if (summary) {
            summary.innerHTML = `<strong>月薪1万元 ≈ ${liang10k}两白银 ≈ 明朝${rank10k.grade}${rank10k.position.split('、')[0]}。</strong>输入你的月薪，我们根据实时银价换算成古代白银重量（两/钱），并匹配明朝官职品级。基于明朝俸禄制度，1石米≈折银1两。`;
        }
    }

    // 添加抖动动画样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-8px); }
            40% { transform: translateX(8px); }
            60% { transform: translateX(-4px); }
            80% { transform: translateX(4px); }
        }

        .input-wrapper.error {
            border-bottom-color: var(--vermilion) !important;
        }
    `;
    document.head.appendChild(style);

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
