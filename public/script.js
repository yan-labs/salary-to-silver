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
        fetchSilverPrice();
        renderRankTable();
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

        // 只显示官职等级（不显示平民等级）
        const officialRanks = RANK_DATA.filter(r =>
            r.grade.includes('品') || r.grade === '未入流'
        );

        officialRanks.forEach(rank => {
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
