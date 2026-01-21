// ===== Global Variables =====
let uploadedData = [];
let processedData = [];
let charts = {};
let rawDataByManager = {}; // 담당자별 원본 데이터 저장
let managerList = []; // 담당자 목록
let selectedManager = 'all'; // 현재 선택된 담당자
let allManagersData = []; // 전체 담당자 합산 데이터 (백업용)
let rawDataByManagerAndProduct = {}; // 담당자+제품 3차원 데이터 저장
let productList = []; // 제품 목록
let selectedProduct = 'all'; // 현재 선택된 제품

// ===== Target DOH Configuration =====
let TARGET_DOH = parseInt(localStorage.getItem('targetDOH')) || 30; // 기본값: 30일

// ===== Login Configuration =====
// LocalStorage에서 사용자 정보 로드, 없으면 기본값 사용
let USERS = JSON.parse(localStorage.getItem('users')) || {
    'admin': 'admin123',
    'manager': 'manager2026'
    // 여기에 사용자 추가 가능
    // 'username': 'password'
};

// 기본 사용자 정보가 없으면 저장
if (!localStorage.getItem('users')) {
    localStorage.setItem('users', JSON.stringify(USERS));
}

// ===== Initialize App =====
document.addEventListener('DOMContentLoaded', function() {
    checkLoginStatus();
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    checkSavedData();
    console.log('IDM 매출관리 시스템 초기화 완료');
}

// ===== Login Management =====
function checkLoginStatus() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const username = localStorage.getItem('username');
    
    if (isLoggedIn && username) {
        showMainApp(username);
    } else {
        showLoginScreen();
    }
}

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

function showMainApp(username) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('userDisplay').textContent = username;
}

function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    // 사용자 인증
    if (USERS[username] && USERS[username] === password) {
        // 로그인 성공
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('username', username);
        
        errorDiv.style.display = 'none';
        showMainApp(username);
        
        console.log(`로그인 성공: ${username}`);
    } else {
        // 로그인 실패
        errorDiv.style.display = 'flex';
        document.getElementById('password').value = '';
        document.getElementById('password').focus();
        
        console.log('로그인 실패');
    }
}

function handleLogout() {
    if (confirm('로그아웃 하시겠습니까?')) {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('username');
        
        // 데이터 초기화
        uploadedData = [];
        processedData = [];
        Object.values(charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        charts = {};
        
        showLoginScreen();
        
        // 폼 초기화
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('loginError').style.display = 'none';
        
        console.log('로그아웃 완료');
    }
}

// ===== Admin Settings =====
function openSettingsModal() {
    document.getElementById('settingsModal').style.display = 'flex';
    
    // 폼 초기화
    document.getElementById('passwordChangeForm').reset();
    document.getElementById('settingsError').style.display = 'none';
    document.getElementById('settingsSuccess').style.display = 'none';
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

function handlePasswordChange(event) {
    event.preventDefault();
    
    const targetUser = document.getElementById('targetUser').value;
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    const errorDiv = document.getElementById('settingsError');
    const successDiv = document.getElementById('settingsSuccess');
    const errorSpan = errorDiv.querySelector('span');
    
    // 에러/성공 메시지 초기화
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    // 검증
    if (!targetUser) {
        errorSpan.textContent = '사용자를 선택해주세요.';
        errorDiv.style.display = 'flex';
        return;
    }
    
    if (!USERS[targetUser]) {
        errorSpan.textContent = '존재하지 않는 사용자입니다.';
        errorDiv.style.display = 'flex';
        return;
    }
    
    if (USERS[targetUser] !== currentPassword) {
        errorSpan.textContent = '현재 비밀번호가 일치하지 않습니다.';
        errorDiv.style.display = 'flex';
        return;
    }
    
    if (newPassword.length < 6) {
        errorSpan.textContent = '새 비밀번호는 최소 6자 이상이어야 합니다.';
        errorDiv.style.display = 'flex';
        return;
    }
    
    if (newPassword !== confirmPassword) {
        errorSpan.textContent = '새 비밀번호가 일치하지 않습니다.';
        errorDiv.style.display = 'flex';
        return;
    }
    
    // 비밀번호 변경
    USERS[targetUser] = newPassword;
    
    // LocalStorage에 저장 (영구 저장)
    localStorage.setItem('users', JSON.stringify(USERS));
    
    // 성공 메시지
    successDiv.style.display = 'flex';
    
    // 폼 초기화
    document.getElementById('passwordChangeForm').reset();
    
    console.log(`비밀번호 변경 완료: ${targetUser}`);
    
    // 3초 후 모달 닫기
    setTimeout(() => {
        closeSettings();
    }, 2000);
}

// ===== DOH Settings Management =====
function updateDOHPreview() {
    const targetDOH = parseInt(document.getElementById('targetDOH').value);
    
    // 유효성 검사
    if (!targetDOH || targetDOH < 15 || targetDOH > 60) {
        return;
    }
    
    // 미리보기 계산
    const excessThreshold = Math.round(targetDOH * 1.5); // 목표의 150%
    const shortageThreshold = Math.round(targetDOH * 0.5); // 목표의 50%
    
    // 미리보기 업데이트
    document.getElementById('previewExcess').textContent = `DOH > ${excessThreshold}일`;
    document.getElementById('previewShortage').textContent = `DOH < ${shortageThreshold}일`;
    document.getElementById('previewOptimal').textContent = `${targetDOH}일 기준`;
}

function handleDOHSettingsChange(event) {
    event.preventDefault();
    
    const targetDOH = parseInt(document.getElementById('targetDOH').value);
    const successDiv = document.getElementById('dohSettingsSuccess');
    
    // 성공 메시지 초기화
    successDiv.style.display = 'none';
    
    // 유효성 검사
    if (!targetDOH || targetDOH < 15 || targetDOH > 60) {
        alert('목표 DOH는 15일 ~ 60일 사이로 설정해주세요.');
        return;
    }
    
    // 전역 변수 업데이트
    TARGET_DOH = targetDOH;
    
    // LocalStorage에 저장
    localStorage.setItem('targetDOH', targetDOH);
    
    // 성공 메시지
    successDiv.style.display = 'flex';
    
    console.log(`목표 DOH 변경 완료: ${targetDOH}일`);
    
    // 데이터가 이미 업로드 되어 있으면 대시보드 재계산
    if (uploadedData.length > 0 && processedData.length > 0) {
        console.log('목표 DOH 변경에 따라 대시보드 재계산 시작...');
        // 지표 재계산
        processedData = calculateMetrics(uploadedData);
        // 대시보드 갱신
        displayDashboard();
    }
    
    // 1.5초 후 성공 메시지 숨기기
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 1500);
}

// ===== Manager Filter Management =====
function handleManagerFilterChange(event) {
    selectedManager = event.target.value;
    console.log(`담당자 필터 변경: ${selectedManager}`);
    
    // 필터 정보 텍스트 업데이트
    const filterInfoText = document.getElementById('filterInfoText');
    if (selectedManager === 'all') {
        filterInfoText.textContent = '전체 담당자의 데이터를 표시하고 있습니다';
    } else {
        filterInfoText.textContent = `${selectedManager} 담당자의 데이터를 표시하고 있습니다`;
    }
    
    // 담당자+제품 조합 필터링 실행
    filterDataByManagerAndProduct();
}

function handleProductFilterChange(event) {
    selectedProduct = event.target.value;
    console.log(`제품 필터 변경: ${selectedProduct}`);
    
    // 필터 정보 텍스트 업데이트
    const productFilterInfoText = document.getElementById('productFilterInfoText');
    if (selectedProduct === 'all') {
        productFilterInfoText.textContent = '전체 제품의 데이터를 표시하고 있습니다';
    } else {
        productFilterInfoText.textContent = `${selectedProduct} 제품의 데이터를 표시하고 있습니다`;
    }
    
    // 담당자+제품 조합 필터링 실행
    filterDataByManagerAndProduct();
}

function filterDataByManagerAndProduct() {
    console.log('=== 담당자+제품 조합 필터링 시작 ===');
    console.log(`선택: 담당자="${selectedManager}", 제품="${selectedProduct}"`);
    
    // Case 1: 전체 담당자 + 전체 제품 → 모든 데이터
    if (selectedManager === 'all' && selectedProduct === 'all') {
        uploadedData = [...allManagersData];
        console.log('✅ 전체 담당자 + 전체 제품:', uploadedData.length, '개월');
    }
    // Case 2: 전체 담당자 + 특정 제품 → 모든 담당자의 해당 제품만
    else if (selectedManager === 'all' && selectedProduct !== 'all') {
        uploadedData = aggregateAllManagersForProduct(selectedProduct);
        console.log(`✅ 전체 담당자 + ${selectedProduct}:`, uploadedData.length, '개월');
    }
    // Case 3: 특정 담당자 + 전체 제품 → 해당 담당자의 모든 제품
    else if (selectedManager !== 'all' && selectedProduct === 'all') {
        if (rawDataByManager[selectedManager]) {
            uploadedData = [...rawDataByManager[selectedManager]];
            console.log(`✅ ${selectedManager} + 전체 제품:`, uploadedData.length, '개월');
        } else {
            console.error(`담당자 ${selectedManager}의 데이터를 찾을 수 없습니다.`);
            return;
        }
    }
    // Case 4: 특정 담당자 + 특정 제품 → 해당 담당자의 해당 제품만
    else {
        if (rawDataByManagerAndProduct[selectedManager] && 
            rawDataByManagerAndProduct[selectedManager][selectedProduct]) {
            
            const productData = rawDataByManagerAndProduct[selectedManager][selectedProduct];
            uploadedData = Object.keys(productData)
                .sort()
                .map(yearMonth => ({
                    date: convertYearMonthToDate(yearMonth),
                    sales: productData[yearMonth].sales,
                    inventory: productData[yearMonth].inventory
                }));
            
            console.log(`✅ ${selectedManager} + ${selectedProduct}:`, uploadedData.length, '개월');
        } else {
            console.error(`담당자 ${selectedManager}의 제품 ${selectedProduct} 데이터를 찾을 수 없습니다.`);
            uploadedData = [];
        }
    }
    
    // 지표 재계산
    processedData = calculateMetrics(uploadedData);
    
    // 대시보드 갱신
    displayDashboard();
}

// 모든 담당자의 특정 제품 데이터 합산
function aggregateAllManagersForProduct(productName) {
    console.log(`모든 담당자의 "${productName}" 제품 데이터 합산 중...`);
    const aggregated = {};
    
    for (const manager in rawDataByManagerAndProduct) {
        if (rawDataByManagerAndProduct[manager][productName]) {
            const productData = rawDataByManagerAndProduct[manager][productName];
            
            for (const yearMonth in productData) {
                if (!aggregated[yearMonth]) {
                    aggregated[yearMonth] = {
                        sales: 0,
                        inventory: 0
                    };
                }
                aggregated[yearMonth].sales += productData[yearMonth].sales;
                aggregated[yearMonth].inventory += productData[yearMonth].inventory;
            }
        }
    }
    
    // 날짜 순으로 정렬하여 배열로 변환
    return Object.keys(aggregated)
        .sort()
        .map(yearMonth => ({
            date: convertYearMonthToDate(yearMonth),
            sales: aggregated[yearMonth].sales,
            inventory: aggregated[yearMonth].inventory
        }));
}

// YYYYMM을 YYYY-MM 형식으로 변환
function convertYearMonthToDate(yearMonth) {
    const year = yearMonth.substring(0, 4);
    const month = yearMonth.substring(4, 6);
    return `${year}-${month}`;
}

function updateManagerDropdown() {
    console.log('=== 담당자 드롭다운 업데이트 ===');
    const managerFilter = document.getElementById('managerFilter');
    
    if (!managerFilter) {
        console.error('❌ managerFilter 엘리먼트를 찾을 수 없습니다!');
        return;
    }
    
    console.log(`담당자 목록 (${managerList.length}명):`, managerList);
    
    // 기존 옵션 초기화 (전체만 유지)
    managerFilter.innerHTML = '<option value="all">전체 (모든 담당자)</option>';
    
    // 담당자 목록 추가
    if (managerList.length > 0) {
        managerList.forEach(manager => {
            const option = document.createElement('option');
            option.value = manager;
            option.textContent = manager;
            managerFilter.appendChild(option);
            console.log(`  옵션 추가: ${manager}`);
        });
        
        console.log(`✅ 드롭다운에 ${managerList.length}명의 담당자 추가 완료`);
    } else {
        console.log('⚠️ 담당자 목록이 비어있습니다.');
    }
}

// 제품 드롭다운 업데이트
function updateProductDropdown() {
    console.log('=== 제품 드롭다운 업데이트 ===');
    const productFilter = document.getElementById('productFilter');
    
    if (!productFilter) {
        console.error('❌ productFilter 엘리먼트를 찾을 수 없습니다!');
        return;
    }
    
    console.log(`제품 목록 (${productList.length}개):`, productList);
    
    // 기존 옵션 초기화 (전체만 유지)
    productFilter.innerHTML = '<option value="all">전체 (모든 제품)</option>';
    
    // 제품 목록 추가
    if (productList.length > 0) {
        productList.forEach(product => {
            const option = document.createElement('option');
            option.value = product;
            option.textContent = product;
            productFilter.appendChild(option);
            console.log(`  옵션 추가: ${product}`);
        });
        
        console.log(`✅ 드롭다운에 ${productList.length}개의 제품 추가 완료`);
    } else {
        console.log('⚠️ 제품 목록이 비어있습니다.');
    }
}

// ===== Dashboard DOH Management =====
function updateDOHInfoText() {
    const targetDOH = parseInt(document.getElementById('targetDOHDashboard')?.value || TARGET_DOH);
    const dohInfoText = document.getElementById('dohInfoText');
    
    if (!dohInfoText) return;
    
    const excessThreshold = Math.round(targetDOH * 1.5);
    const shortageThreshold = Math.round(targetDOH * 0.5);
    
    dohInfoText.innerHTML = `현재 목표: <strong>${targetDOH}일</strong> | 과잉 경고: ${excessThreshold}일 초과 | 부족 경고: ${shortageThreshold}일 미만`;
}

function handleDashboardDOHChange() {
    const targetDOHInput = document.getElementById('targetDOHDashboard');
    const targetDOH = parseInt(targetDOHInput.value);
    
    // 유효성 검사
    if (!targetDOH || targetDOH < 15 || targetDOH > 60) {
        alert('목표 DOH는 15일 ~ 60일 사이로 설정해주세요.');
        targetDOHInput.value = TARGET_DOH; // 이전 값으로 복원
        return;
    }
    
    // 전역 변수 업데이트
    TARGET_DOH = targetDOH;
    
    // LocalStorage에 저장
    localStorage.setItem('targetDOH', targetDOH);
    
    // 정보 텍스트 업데이트
    updateDOHInfoText();
    
    console.log(`목표 DOH 변경 완료: ${targetDOH}일`);
    
    // 성공 메시지 표시 (버튼 텍스트 변경)
    const applyBtn = document.getElementById('applyDOHBtn');
    const originalHTML = applyBtn.innerHTML;
    applyBtn.innerHTML = '<i class="fas fa-check-circle"></i> 적용 완료!';
    applyBtn.style.background = 'var(--accent-green)';
    
    setTimeout(() => {
        applyBtn.innerHTML = originalHTML;
        applyBtn.style.background = '';
    }, 2000);
    
    // 데이터가 이미 업로드 되어 있으면 대시보드 재계산
    if (uploadedData.length > 0 && processedData.length > 0) {
        console.log('목표 DOH 변경에 따라 대시보드 재계산 시작...');
        
        // 목표 DOH 기준 적정 매출 카드 업데이트
        updateOptimalSales();
        
        // 알림 재생성 (임계값 변경 반영)
        generateAlerts();
    }
}

// ===== Event Listeners =====
function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Settings button
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettingsModal);
    }
    
    // Close settings modal
    const closeSettingsModal = document.getElementById('closeSettingsModal');
    if (closeSettingsModal) {
        closeSettingsModal.addEventListener('click', closeSettings);
    }
    
    // Close modal on background click
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) {
        settingsModal.addEventListener('click', function(e) {
            if (e.target === settingsModal) {
                closeSettings();
            }
        });
    }
    
    // Password change form
    const passwordChangeForm = document.getElementById('passwordChangeForm');
    if (passwordChangeForm) {
        passwordChangeForm.addEventListener('submit', handlePasswordChange);
    }
    
    // DOH Settings form
    const dohSettingsForm = document.getElementById('dohSettingsForm');
    if (dohSettingsForm) {
        dohSettingsForm.addEventListener('submit', handleDOHSettingsChange);
    }
    
    // Target DOH input - 실시간 미리보기 업데이트
    const targetDOHInput = document.getElementById('targetDOH');
    if (targetDOHInput) {
        targetDOHInput.addEventListener('input', updateDOHPreview);
        // 초기 값 설정
        targetDOHInput.value = TARGET_DOH;
        updateDOHPreview();
    }
    
    // Saved data buttons
    const loadSavedDataBtn = document.getElementById('loadSavedDataBtn');
    if (loadSavedDataBtn) {
        loadSavedDataBtn.addEventListener('click', loadSavedData);
    }
    
    const deleteSavedDataBtn = document.getElementById('deleteSavedDataBtn');
    if (deleteSavedDataBtn) {
        deleteSavedDataBtn.addEventListener('click', deleteSavedData);
    }
    
    // Manager filter
    const managerFilter = document.getElementById('managerFilter');
    if (managerFilter) {
        managerFilter.addEventListener('change', handleManagerFilterChange);
    }
    
    // Product filter
    const productFilter = document.getElementById('productFilter');
    if (productFilter) {
        productFilter.addEventListener('change', handleProductFilterChange);
    }
    
    // Dashboard DOH Setting
    const targetDOHDashboard = document.getElementById('targetDOHDashboard');
    const applyDOHBtn = document.getElementById('applyDOHBtn');
    
    if (targetDOHDashboard) {
        // 초기 값 설정
        targetDOHDashboard.value = TARGET_DOH;
        updateDOHInfoText();
        
        // 입력 시 실시간 정보 업데이트
        targetDOHDashboard.addEventListener('input', updateDOHInfoText);
    }
    
    if (applyDOHBtn) {
        applyDOHBtn.addEventListener('click', handleDashboardDOHChange);
    }
    
    // File input
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    
    fileInput.addEventListener('change', handleFileSelect);
    uploadArea.addEventListener('click', () => fileInput.click());
    
    // Drag and drop
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    
    // Buttons
    document.getElementById('downloadSampleBtn').addEventListener('click', downloadSampleData);
    document.getElementById('analyzeBtn').addEventListener('click', analyzeData);
    document.getElementById('resetBtn').addEventListener('click', resetApp);
    document.getElementById('downloadReportBtn').addEventListener('click', downloadReport);
}

// ===== Drag and Drop Handlers =====
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processFile(file);
    }
}

// ===== File Processing =====
function processFile(file) {
    const fileName = file.name;
    const fileExtension = fileName.split('.').pop().toLowerCase();
    
    if (fileExtension === 'csv') {
        parseCSV(file);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        parseExcel(file);
    } else {
        alert('지원하지 않는 파일 형식입니다. CSV 또는 Excel 파일을 업로드해주세요.');
    }
}

function parseCSV(file) {
    Papa.parse(file, {
        header: false, // 헤더를 배열로 받기
        skipEmptyLines: true,
        dynamicTyping: false, // 자동 타입 변환 비활성화 (문자열 유지)
        complete: function(results) {
            if (results.errors.length > 0) {
                console.warn('CSV 파싱 경고:', results.errors);
            }
            
            const rawData = results.data;
            console.log('CSV 데이터 로드:', rawData.length, '행');
            console.log('첫 번째 행(헤더):', rawData[0]);
            
            // MIS 형식인지 확인 (헤더에 YYYYMM 패턴이 있는지)
            const isMISFormat = checkIfMISFormat(rawData[0]);
            
            if (isMISFormat) {
                console.log('MIS 형식 감지됨');
                uploadedData = parseMISFormat(rawData);
            } else {
                console.log('단순 형식으로 파싱 시도');
                // 단순 형식으로 파싱 (header: true로 다시)
                Papa.parse(file, {
                    header: true,
                    skipEmptyLines: true,
                    complete: function(results2) {
                        uploadedData = validateAndCleanData(results2.data);
                        
                        if (uploadedData.length === 0) {
                            alert('유효한 데이터가 없습니다.\n\n지원 형식:\n1. MIS 형식: "거래처명, 202412 매출, 202412 재고, ..."\n2. 단순 형식: "날짜, 매출액, 재고금액"');
                            return;
                        }
                        
                        displayDataPreview(uploadedData);
                    }
                });
                return;
            }
            
            if (uploadedData.length === 0) {
                alert('유효한 데이터가 없습니다.\n\n지원 형식:\n1. MIS 형식: "거래처명, 202412 매출, 202412 재고, ..."\n2. 단순 형식: "날짜, 매출액, 재고금액"');
                return;
            }
            
            console.log('변환된 데이터:', uploadedData);
            displayDataPreview(uploadedData);
        },
        error: function(error) {
            alert('파일 읽기 오류: ' + error.message);
        }
    });
}

// ===== Check if MIS Format =====
function checkIfMISFormat(headers) {
    if (!headers || headers.length === 0) return false;
    
    // 헤더에 YYYYMM 패턴이 있는지 확인
    for (let header of headers) {
        const headerStr = String(header).trim();
        if (headerStr.match(/\d{6}\s*(MIS)?매출/) || headerStr.match(/\d{6}\s*재고/)) {
            return true;
        }
    }
    return false;
}

// ===== Excel File Processing =====
function parseExcel(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // 첫 번째 시트 읽기
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // JSON으로 변환 (헤더 포함)
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            console.log('Excel 데이터 로드 완료:', jsonData.length, '행');
            
            // MIS 형식 데이터 변환
            uploadedData = parseMISFormat(jsonData);
            
            if (uploadedData.length === 0) {
                alert('유효한 데이터가 없습니다. 데이터 형식을 확인해주세요.\n\n예상 형식: 헤더에 "YYYYMM 매출", "YYYYMM 재고" 컬럼이 있어야 합니다.');
                return;
            }
            
            console.log('변환된 데이터:', uploadedData);
            displayDataPreview(uploadedData);
            
        } catch (error) {
            alert('Excel 파일 처리 중 오류가 발생했습니다: ' + error.message);
            console.error(error);
        }
    };
    
    reader.onerror = function(error) {
        alert('파일 읽기 오류: ' + error);
    };
    
    reader.readAsArrayBuffer(file);
}

// ===== MIS Format Parser =====
function parseMISFormat(data) {
    if (data.length < 2) {
        return [];
    }
    
    // 헤더 행 (첫 번째 행)
    const headers = data[0];
    
    console.log('=== Excel 헤더 분석 ===');
    console.log('헤더:', headers);
    console.log('헤더 개수:', headers.length);
    
    // 관리담당자 컬럼 찾기
    let managerColIndex = -1;
    console.log('담당자 컬럼 찾기 시작...');
    for (let i = 0; i < headers.length; i++) {
        const header = String(headers[i]).trim();
        const headerLower = header.toLowerCase();
        console.log(`  컬럼 ${i}: "${header}" (소문자: "${headerLower}")`);
        
        if (headerLower.includes('담당자') || headerLower.includes('관리자') || headerLower.includes('manager')) {
            managerColIndex = i;
            console.log(`✅ 담당자 컬럼 발견! ${i}번째 컬럼: "${headers[i]}"`);
            break;
        }
    }
    
    if (managerColIndex === -1) {
        console.log('⚠️ 담당자 컬럼을 찾지 못했습니다.');
    }
    
    // 제품명 컬럼 찾기
    let productColIndex = -1;
    console.log('제품명 컬럼 찾기 시작...');
    for (let i = 0; i < headers.length; i++) {
        const header = String(headers[i]).trim();
        const headerLower = header.toLowerCase();
        
        if (headerLower.includes('제품') || headerLower.includes('상품') || 
            headerLower.includes('product') || headerLower === '품목' || 
            headerLower.includes('item')) {
            productColIndex = i;
            console.log(`✅ 제품명 컬럼 발견! ${i}번째 컬럼: "${headers[i]}"`);
            break;
        }
    }
    
    if (productColIndex === -1) {
        console.log('⚠️ 제품명 컬럼을 찾지 못했습니다.');
    }
    
    // 날짜별 매출/재고 컬럼 찾기
    // 형식: "202412 매출", "202412 재고", "202501 매출", "202501 재고" 등
    const dateColumns = {};
    
    for (let i = 0; i < headers.length; i++) {
        const header = String(headers[i]).trim();
        
        // "YYYYMM 매출" 또는 "YYYYMM MIS매출" 패턴 매칭
        const salesMatch = header.match(/(\d{6})\s*(MIS)?매출/);
        if (salesMatch) {
            const yearMonth = salesMatch[1];
            if (!dateColumns[yearMonth]) {
                dateColumns[yearMonth] = {};
            }
            dateColumns[yearMonth].salesCol = i;
        }
        
        // "YYYYMM 재고" 패턴 매칭
        const inventoryMatch = header.match(/(\d{6})\s*재고/);
        if (inventoryMatch) {
            const yearMonth = inventoryMatch[1];
            if (!dateColumns[yearMonth]) {
                dateColumns[yearMonth] = {};
            }
            dateColumns[yearMonth].inventoryCol = i;
        }
    }
    
    console.log('인식된 날짜 컬럼:', dateColumns);
    
    if (Object.keys(dateColumns).length === 0) {
        console.error('날짜 컬럼을 찾을 수 없습니다');
        return [];
    }
    
    // 담당자별/제품별 데이터 저장 객체 초기화
    rawDataByManager = {};
    rawDataByManagerAndProduct = {};
    managerList = [];
    productList = [];
    
    // 담당자 또는 제품 컬럼이 있는 경우
    if (managerColIndex !== -1 || productColIndex !== -1) {
        console.log('=== 담당자/제품별 데이터 분석 시작 ===');
        if (managerColIndex !== -1) console.log(`담당자 컬럼 인덱스: ${managerColIndex}`);
        if (productColIndex !== -1) console.log(`제품 컬럼 인덱스: ${productColIndex}`);
        
        // 각 행을 순회하며 담당자+제품별로 데이터 분류
        for (let row = 1; row < data.length; row++) {
            const rowData = data[row];
            const firstCell = String(rowData[0] || '').trim();
            
            // 총합계 행은 건너뛰기
            if (firstCell.includes('계') || firstCell.includes('총계') || firstCell.includes('합계') ||
                firstCell.toLowerCase().includes('total') || firstCell.toLowerCase().includes('sum')) {
                console.log(`총합계 행 건너뛰기: ${row}번째 행 (${firstCell})`);
                continue;
            }
            
            // 담당자 이름 추출 (담당자 컬럼이 없으면 '전체')
            const managerName = managerColIndex !== -1 
                ? String(rowData[managerColIndex] || '').trim() 
                : '전체';
            
            // 제품명 추출 (제품 컬럼이 없으면 '전체')
            const productName = productColIndex !== -1 
                ? String(rowData[productColIndex] || '').trim() 
                : '전체';
            
            if (!managerName || !productName) {
                console.log(`${row}번째 행: 담당자 또는 제품 정보 없음`);
                continue;
            }
            
            console.log(`${row}번째 행: 담당자 = "${managerName}", 제품 = "${productName}"`);
            
            // 담당자 목록에 추가 (중복 방지)
            if (!managerList.includes(managerName)) {
                managerList.push(managerName);
                rawDataByManager[managerName] = {};
                rawDataByManagerAndProduct[managerName] = {};
                console.log(`  → 새 담당자 추가: "${managerName}"`);
            }
            
            // 제품 목록에 추가 (중복 방지)
            if (!productList.includes(productName)) {
                productList.push(productName);
                console.log(`  → 새 제품 추가: "${productName}"`);
            }
            
            // 제품별 데이터 초기화
            if (!rawDataByManagerAndProduct[managerName][productName]) {
                rawDataByManagerAndProduct[managerName][productName] = {};
            }
            
            // 각 날짜별 매출/재고 데이터 추출
            for (const yearMonth in dateColumns) {
                const cols = dateColumns[yearMonth];
                
                if (cols.salesCol === undefined || cols.inventoryCol === undefined) {
                    continue;
                }
                
                const salesValue = rowData[cols.salesCol];
                const inventoryValue = rowData[cols.inventoryCol];
                
                // 숫자로 변환
                const sales = parseFloat(String(salesValue).replace(/[^0-9.-]/g, ''));
                const inventory = parseFloat(String(inventoryValue).replace(/[^0-9.-]/g, ''));
                
                // 매출과 재고가 모두 유효한 숫자이고, 둘 다 0 이상인 경우 (0 포함)
                if (!isNaN(sales) && !isNaN(inventory) && sales >= 0 && inventory >= 0) {
                    // 담당자별 전체 합산
                    if (!rawDataByManager[managerName][yearMonth]) {
                        rawDataByManager[managerName][yearMonth] = {
                            sales: 0,
                            inventory: 0
                        };
                    }
                    rawDataByManager[managerName][yearMonth].sales += sales;
                    rawDataByManager[managerName][yearMonth].inventory += inventory;
                    
                    // 담당자+제품별 합산
                    if (!rawDataByManagerAndProduct[managerName][productName][yearMonth]) {
                        rawDataByManagerAndProduct[managerName][productName][yearMonth] = {
                            sales: 0,
                            inventory: 0
                        };
                    }
                    rawDataByManagerAndProduct[managerName][productName][yearMonth].sales += sales;
                    rawDataByManagerAndProduct[managerName][productName][yearMonth].inventory += inventory;
                }
            }
        }
        
        console.log('=== 담당자/제품별 데이터 분석 완료 ===');
        console.log(`담당자 ${managerList.length}명 발견:`, managerList);
        console.log(`제품 ${productList.length}개 발견:`, productList);
        console.log('담당자별 데이터:', rawDataByManager);
        console.log('담당자+제품별 데이터:', rawDataByManagerAndProduct);
        
        // 담당자/제품 드롭다운 업데이트
        updateManagerDropdown();
        updateProductDropdown();
    } else {
        console.log('⚠️ 담당자/제품 컬럼이 없습니다. 전체 데이터만 분석합니다.');
    }
    
    // 전체 합산 데이터 계산 (기존 로직)
    const result = [];
    
    // 첫 번째 컬럼에서 "계", "총계", "합계" 등을 찾아 총합계 행 확인
    let summaryRowIndex = -1;
    for (let row = 1; row < data.length; row++) {
        const firstCell = String(data[row][0] || '').trim();
        // "IDM팀 계", "팀 계", "총계", "합계" 등 패턴 매칭
        if (firstCell.includes('계') || firstCell.includes('총계') || firstCell.includes('합계') || 
            firstCell.toLowerCase().includes('total') || firstCell.toLowerCase().includes('sum')) {
            summaryRowIndex = row;
            console.log(`총합계 행 발견: ${row}번째 행 (${firstCell})`);
            break;
        }
    }
    
    for (const yearMonth in dateColumns) {
        const cols = dateColumns[yearMonth];
        
        // 매출과 재고 컬럼이 둘 다 있는지 확인
        if (cols.salesCol === undefined || cols.inventoryCol === undefined) {
            console.warn(`${yearMonth}: 매출 또는 재고 컬럼 누락`);
            continue;
        }
        
        let totalSales = 0;
        let totalInventory = 0;
        let validRows = 0;
        
        // 총합계 행이 있으면 그것만 사용
        if (summaryRowIndex !== -1) {
            const rowData = data[summaryRowIndex];
            
            const salesValue = rowData[cols.salesCol];
            const inventoryValue = rowData[cols.inventoryCol];
            
            // 숫자로 변환
            const sales = parseFloat(String(salesValue).replace(/[^0-9.-]/g, ''));
            const inventory = parseFloat(String(inventoryValue).replace(/[^0-9.-]/g, ''));
            
            if (!isNaN(sales) && !isNaN(inventory) && sales >= 0 && inventory >= 0) {
                totalSales = sales;
                totalInventory = inventory;
                validRows = 1;
                console.log(`${yearMonth}: 총합계 행 사용 - 매출=${sales}, 재고=${inventory}`);
            }
        } else {
            // 총합계 행이 없으면 개별 행들을 합산 (헤더와 총계 행 제외)
            for (let row = 1; row < data.length; row++) {
                const rowData = data[row];
                
                // 첫 번째 셀이 "계" 등을 포함하면 건너뛰기 (혹시 모를 중복 방지)
                const firstCell = String(rowData[0] || '').trim();
                if (firstCell.includes('계') || firstCell.includes('총계') || firstCell.includes('합계')) {
                    continue;
                }
                
                const salesValue = rowData[cols.salesCol];
                const inventoryValue = rowData[cols.inventoryCol];
                
                // 숫자로 변환
                const sales = parseFloat(String(salesValue).replace(/[^0-9.-]/g, ''));
                const inventory = parseFloat(String(inventoryValue).replace(/[^0-9.-]/g, ''));
                
                // 매출과 재고가 모두 유효한 숫자이고, 둘 다 0 이상인 경우 (0 포함)
                if (!isNaN(sales) && !isNaN(inventory) && sales >= 0 && inventory >= 0) {
                    totalSales += sales;
                    totalInventory += inventory;
                    validRows++;
                }
            }
            console.log(`${yearMonth}: 개별 합산 - ${validRows}개 거래처`);
        }
        
        if (validRows > 0) {
            // YYYYMM → YYYY-MM 형식 변환
            const formattedDate = yearMonth.slice(0, 4) + '-' + yearMonth.slice(4, 6);
            
            result.push({
                date: formattedDate,
                sales: totalSales,
                inventory: totalInventory
            });
            
            console.log(`${formattedDate}: 매출=${totalSales.toLocaleString()}, 재고=${totalInventory.toLocaleString()}`);
        }
    }
    
    // 담당자별 데이터도 변환 (rawDataByManager를 월별 배열로)
    if (managerList.length > 0) {
        for (const manager of managerList) {
            const managerData = [];
            for (const yearMonth in rawDataByManager[manager]) {
                const formattedDate = yearMonth.slice(0, 4) + '-' + yearMonth.slice(4, 6);
                managerData.push({
                    date: formattedDate,
                    sales: rawDataByManager[manager][yearMonth].sales,
                    inventory: rawDataByManager[manager][yearMonth].inventory
                });
            }
            // 날짜순 정렬
            managerData.sort((a, b) => a.date.localeCompare(b.date));
            rawDataByManager[manager] = managerData;
        }
    }
    
    // 날짜순 정렬
    result.sort((a, b) => {
        return a.date.localeCompare(b.date);
    });
    
    // 전체 데이터 백업 (담당자 필터 사용 시 복원용)
    allManagersData = [...result];
    
    return result;
}

// ===== Data Validation =====
function validateAndCleanData(data) {
    const cleaned = [];
    
    console.log('데이터 검증 시작, 총 행 수:', data.length);
    if (data.length > 0) {
        console.log('첫 번째 행 샘플:', data[0]);
    }
    
    for (let row of data) {
        // 빈 객체 건너뛰기
        if (!row || Object.keys(row).length === 0) {
            continue;
        }
        
        // 컬럼명 정규화 (띄어쓰기, 대소문자 무시)
        const normalizedRow = {};
        for (let key in row) {
            const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, '');
            normalizedRow[normalizedKey] = row[key];
        }
        
        // 필수 컬럼 확인 (더 많은 패턴 지원)
        const dateValue = normalizedRow['날짜'] || 
                         normalizedRow['date'] || 
                         normalizedRow['month'] || 
                         normalizedRow['년월'] ||
                         normalizedRow['기간'] ||
                         normalizedRow['일자'] || '';
        
        const salesValue = normalizedRow['매출액'] || 
                          normalizedRow['sales'] || 
                          normalizedRow['매출'] ||
                          normalizedRow['판매액'] ||
                          normalizedRow['판매금액'] || '';
        
        const inventoryValue = normalizedRow['재고금액'] || 
                              normalizedRow['inventory'] || 
                              normalizedRow['재고'] ||
                              normalizedRow['재고량'] ||
                              normalizedRow['창고재고'] || '';
        
        // 데이터 검증
        if (dateValue && salesValue && inventoryValue) {
            const sales = parseFloat(String(salesValue).replace(/[^0-9.-]/g, ''));
            const inventory = parseFloat(String(inventoryValue).replace(/[^0-9.-]/g, ''));
            
            if (!isNaN(sales) && !isNaN(inventory) && sales > 0 && inventory > 0) {
                // 날짜 형식 정규화
                let formattedDate = String(dateValue).trim();
                
                // YYYYMM 형식을 YYYY-MM으로 변환
                if (/^\d{6}$/.test(formattedDate)) {
                    formattedDate = formattedDate.slice(0, 4) + '-' + formattedDate.slice(4, 6);
                }
                
                cleaned.push({
                    date: formattedDate,
                    sales: sales,
                    inventory: inventory
                });
                
                console.log('유효한 데이터 발견:', formattedDate, sales, inventory);
            }
        }
    }
    
    console.log('검증 완료, 유효한 데이터:', cleaned.length, '개');
    
    // 날짜순 정렬
    cleaned.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA - dateB;
    });
    
    return cleaned;
}

// ===== Display Data Preview =====
function displayDataPreview(data) {
    const previewSection = document.getElementById('dataPreview');
    const tableBody = document.getElementById('previewTableBody');
    
    tableBody.innerHTML = '';
    
    // 최대 10개 행만 미리보기
    const previewData = data.slice(0, 10);
    
    previewData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.date}</td>
            <td>${formatCurrency(row.sales)}</td>
            <td>${formatCurrency(row.inventory)}</td>
        `;
        tableBody.appendChild(tr);
    });
    
    previewSection.style.display = 'block';
    previewSection.scrollIntoView({ behavior: 'smooth' });
}

// ===== Data Storage Management =====
function checkSavedData() {
    const savedData = localStorage.getItem('uploadedData');
    const savedDate = localStorage.getItem('uploadedDataDate');
    
    if (savedData) {
        const data = JSON.parse(savedData);
        const notice = document.getElementById('savedDataNotice');
        const details = document.getElementById('savedDataDetails');
        
        if (notice && details && data.length > 0) {
            const dateStr = savedDate ? new Date(savedDate).toLocaleString('ko-KR') : '알 수 없음';
            details.textContent = `마지막 저장: ${dateStr} | 데이터: ${data.length}개월`;
            notice.style.display = 'block';
        }
    }
}

function saveDataToStorage(data) {
    try {
        localStorage.setItem('uploadedData', JSON.stringify(data));
        localStorage.setItem('uploadedDataDate', new Date().toISOString());
        
        // 담당자별 데이터도 저장
        if (Object.keys(rawDataByManager).length > 0) {
            localStorage.setItem('rawDataByManager', JSON.stringify(rawDataByManager));
            localStorage.setItem('managerList', JSON.stringify(managerList));
            localStorage.setItem('allManagersData', JSON.stringify(allManagersData));
            console.log('담당자별 데이터도 저장 완료:', managerList.length, '명');
        }
        
        // 제품별 데이터도 저장
        if (Object.keys(rawDataByManagerAndProduct).length > 0) {
            localStorage.setItem('rawDataByManagerAndProduct', JSON.stringify(rawDataByManagerAndProduct));
            localStorage.setItem('productList', JSON.stringify(productList));
            console.log('제품별 데이터도 저장 완료:', productList.length, '개');
        }
        
        console.log('데이터 저장 완료:', data.length, '개월');
    } catch (error) {
        console.error('데이터 저장 실패:', error);
        alert('데이터 저장에 실패했습니다. 브라우저 저장 공간을 확인해주세요.');
    }
}

function loadSavedData() {
    const savedData = localStorage.getItem('uploadedData');
    
    if (!savedData) {
        alert('저장된 데이터가 없습니다.');
        return;
    }
    
    try {
        uploadedData = JSON.parse(savedData);
        
        if (uploadedData.length === 0) {
            alert('저장된 데이터가 비어있습니다.');
            return;
        }
        
        // 담당자별 데이터도 불러오기
        const savedManagerData = localStorage.getItem('rawDataByManager');
        const savedManagerList = localStorage.getItem('managerList');
        const savedAllManagersData = localStorage.getItem('allManagersData');
        
        if (savedManagerData && savedManagerList) {
            rawDataByManager = JSON.parse(savedManagerData);
            managerList = JSON.parse(savedManagerList);
            
            if (savedAllManagersData) {
                allManagersData = JSON.parse(savedAllManagersData);
            }
            
            updateManagerDropdown();
            console.log('담당자별 데이터 불러오기 완료:', managerList.length, '명');
        }
        
        // 제품별 데이터도 불러오기
        const savedProductData = localStorage.getItem('rawDataByManagerAndProduct');
        const savedProductList = localStorage.getItem('productList');
        
        if (savedProductData && savedProductList) {
            rawDataByManagerAndProduct = JSON.parse(savedProductData);
            productList = JSON.parse(savedProductList);
            
            updateProductDropdown();
            console.log('제품별 데이터 불러오기 완료:', productList.length, '개');
        }
        
        console.log('저장된 데이터 불러오기 완료:', uploadedData.length, '개월');
        
        // 데이터 미리보기 표시
        displayDataPreview(uploadedData);
        
        // 저장된 데이터 알림 숨기기
        document.getElementById('savedDataNotice').style.display = 'none';
        
    } catch (error) {
        console.error('데이터 불러오기 실패:', error);
        alert('저장된 데이터를 불러오는데 실패했습니다.');
    }
}

function deleteSavedData() {
    if (confirm('저장된 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
        localStorage.removeItem('uploadedData');
        localStorage.removeItem('uploadedDataDate');
        localStorage.removeItem('rawDataByManager');
        localStorage.removeItem('managerList');
        localStorage.removeItem('allManagersData');
        localStorage.removeItem('rawDataByManagerAndProduct');
        localStorage.removeItem('productList');
        
        document.getElementById('savedDataNotice').style.display = 'none';
        
        console.log('저장된 데이터 삭제 완료');
        alert('저장된 데이터가 삭제되었습니다.');
    }
}

// ===== Data Analysis =====
function analyzeData() {
    if (uploadedData.length < 2) {
        alert('분석을 위해 최소 2개월 이상의 데이터가 필요합니다.');
        return;
    }
    
    // 데이터 자동 저장
    saveDataToStorage(uploadedData);
    
    // 데이터 처리 및 계산
    processedData = calculateMetrics(uploadedData);
    
    // 대시보드 표시
    displayDashboard();
}

function calculateMetrics(data) {
    const processed = [];
    
    for (let i = 0; i < data.length; i++) {
        const current = data[i];
        
        // 재고회전율 = 매출액 / 재고금액
        const turnoverRatio = current.sales / current.inventory;
        
        // DOH (Days on Hand) = 재고금액 / (매출액 / 30일)
        const doh = current.inventory / (current.sales / 30);
        
        // 월별 증감률 (MoM)
        let momGrowth = null;
        if (i > 0) {
            const previous = data[i - 1];
            momGrowth = ((current.sales - previous.sales) / previous.sales) * 100;
        }
        
        // 전년 동월 대비 증감률 (YoY)
        let yoyGrowth = null;
        if (i >= 12) {
            const lastYear = data[i - 12];
            yoyGrowth = ((current.sales - lastYear.sales) / lastYear.sales) * 100;
        }
        
        processed.push({
            date: current.date,
            sales: current.sales,
            inventory: current.inventory,
            turnoverRatio: turnoverRatio,
            doh: doh,
            momGrowth: momGrowth,
            yoyGrowth: yoyGrowth
        });
    }
    
    return processed;
}

// ===== AI Forecasting =====
function forecastNextMonth(data) {
    if (data.length < 2) {
        // 데이터 부족 시 단순 평균
        const avgSales = data.reduce((sum, d) => sum + d.sales, 0) / data.length;
        return {
            trendForecast: avgSales,
            inventoryForecast: avgSales,
            forecast: avgSales,
            lower: avgSales * 0.85,
            upper: avgSales * 1.15,
            method: 'simple_average'
        };
    }
    
    // 최신 재고 데이터
    const latestData = data[data.length - 1];
    const latestInventory = latestData.inventory;
    
    // 평균 재고회전율 계산
    const avgTurnoverRatio = data.reduce((sum, d) => sum + d.turnoverRatio, 0) / data.length;
    
    // 재고 기반 적정 매출 = 현재 재고 × 평균 재고회전율
    const inventoryBasedForecast = latestInventory * avgTurnoverRatio;
    
    console.log(`재고 기반 예측: 재고=${latestInventory.toLocaleString()}, 평균회전율=${avgTurnoverRatio.toFixed(2)}, 예측매출=${inventoryBasedForecast.toLocaleString()}`);
    
    // 트렌드 기반 예측
    let trendBasedForecast = 0;
    
    if (data.length >= 3) {
        const recent = data.slice(-6); // 최근 6개월
        
        // 가중 이동평균 (최근 데이터에 더 높은 가중치)
        let weightedSum = 0;
        let weightTotal = 0;
        for (let i = 0; i < recent.length; i++) {
            const weight = i + 1;
            weightedSum += recent[i].sales * weight;
            weightTotal += weight;
        }
        const weightedAvg = weightedSum / weightTotal;
        
        // 선형 트렌드 계산
        const trend = calculateLinearTrend(recent.map(d => d.sales));
        
        // 트렌드 예측값 = 가중평균 + 트렌드
        trendBasedForecast = weightedAvg + trend;
        
        console.log(`트렌드 기반 예측: 가중평균=${weightedAvg.toLocaleString()}, 트렌드=${trend.toFixed(0)}, 예측매출=${trendBasedForecast.toLocaleString()}`);
    } else {
        // 데이터 부족 시 평균 사용
        trendBasedForecast = data.reduce((sum, d) => sum + d.sales, 0) / data.length;
    }
    
    // 최종 예측: 재고 기반 50% + 트렌드 기반 50% (가중 평균)
    // 재고가 더 중요하므로 재고 기반에 60% 가중치
    const finalForecast = (inventoryBasedForecast * 0.6) + (trendBasedForecast * 0.4);
    
    console.log(`최종 예측: (재고 60% + 트렌드 40%) = ${finalForecast.toLocaleString()}`);
    
    // 표준편차 기반 신뢰구간
    const salesValues = data.slice(-6).map(d => d.sales);
    const stdDev = calculateStdDev(salesValues);
    
    return {
        trendForecast: trendBasedForecast,
        inventoryForecast: inventoryBasedForecast,
        forecast: finalForecast,
        lower: finalForecast - (1.96 * stdDev), // 95% 신뢰구간
        upper: finalForecast + (1.96 * stdDev),
        method: 'hybrid',
        avgTurnoverRatio: avgTurnoverRatio
    };
}

function calculateLinearTrend(values) {
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += values[i];
        sumXY += i * values[i];
        sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
}

function calculateStdDev(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
}

// ===== Display Dashboard =====
function displayDashboard() {
    // 목표 DOH 입력 필드 초기화
    const targetDOHDashboard = document.getElementById('targetDOHDashboard');
    if (targetDOHDashboard) {
        targetDOHDashboard.value = TARGET_DOH;
        updateDOHInfoText();
    }
    
    // KPI 카드 업데이트
    updateKPICards();
    
    // 알림 생성
    generateAlerts();
    
    // 차트 생성
    createCharts();
    
    // 상세 테이블 생성
    populateDetailsTable();
    
    // 대시보드 섹션 표시
    document.getElementById('uploadSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';
    document.getElementById('dashboardSection').scrollIntoView({ behavior: 'smooth' });
}

// ===== Update KPI Cards =====
function updateKPICards() {
    const latest = processedData[processedData.length - 1];
    const avgTurnover = processedData.reduce((sum, d) => sum + d.turnoverRatio, 0) / processedData.length;
    const avgDOH = processedData.reduce((sum, d) => sum + d.doh, 0) / processedData.length;
    
    // AI 예측 계산
    const forecast = forecastNextMonth(processedData);
    
    // 다음 달 날짜 계산
    const lastDate = new Date(latest.date + '-01');
    lastDate.setMonth(lastDate.getMonth() + 1);
    const nextMonth = lastDate.toISOString().slice(0, 7);
    const nextMonthFormatted = `${lastDate.getFullYear()}년 ${lastDate.getMonth() + 1}월`;
    
    document.getElementById('currentInventory').textContent = formatCurrency(latest.inventory);
    document.getElementById('avgTurnover').textContent = avgTurnover.toFixed(2);
    document.getElementById('avgDOH').textContent = avgDOH.toFixed(1) + '일';
    
    // "이번 달 매출" → "다음 달 예상 매출"로 변경
    document.getElementById('currentSales').textContent = formatCurrency(forecast.forecast);
    
    // 매출 트렌드 → 예측 근거로 변경
    const trendElement = document.getElementById('salesTrend');
    const forecastChange = ((forecast.forecast - latest.sales) / latest.sales) * 100;
    const trendText = forecastChange >= 0 
        ? `▲ ${forecastChange.toFixed(1)}% (${nextMonthFormatted} 예측)`
        : `▼ ${Math.abs(forecastChange).toFixed(1)}% (${nextMonthFormatted} 예측)`;
    trendElement.textContent = trendText;
    trendElement.style.color = forecastChange >= 0 ? '#10b981' : '#ef4444';
    
    // 목표 DOH 기준 적정 매출 계산 및 표시
    updateOptimalSales();
}

// ===== Update Optimal Sales (Target DOH Based) =====
function updateOptimalSales() {
    const latest = processedData[processedData.length - 1];
    
    // 목표 DOH 기준 적정 매출 = (현재 재고 / 목표 DOH) × 30일
    const optimalSales = (latest.inventory / TARGET_DOH) * 30;
    
    document.getElementById('optimalSales').textContent = formatCurrency(optimalSales);
    document.getElementById('optimalSalesLabel').textContent = `목표 ${TARGET_DOH}일 기준`;
    
    console.log(`목표 DOH 기준 적정 매출: 재고=${latest.inventory.toLocaleString()}, 목표DOH=${TARGET_DOH}일, 적정매출=${optimalSales.toLocaleString()}`);
}

// ===== Generate Alerts =====
function generateAlerts() {
    const alertsContainer = document.getElementById('alertsContainer');
    alertsContainer.innerHTML = '';
    
    const latest = processedData[processedData.length - 1];
    const forecast = forecastNextMonth(processedData);
    
    // 다음 달 날짜 계산
    const lastDate = new Date(latest.date + '-01');
    lastDate.setMonth(lastDate.getMonth() + 1);
    const nextMonthFormatted = `${lastDate.getFullYear()}년 ${lastDate.getMonth() + 1}월`;
    
    // AI 예측 인사이트 (최우선 표시)
    const forecastChange = ((forecast.forecast - latest.sales) / latest.sales) * 100;
    addAlert('info', `${nextMonthFormatted} AI 매출 예측`, 
        `예상 매출: ${formatCurrency(forecast.forecast)} (${forecastChange >= 0 ? '+' : ''}${forecastChange.toFixed(1)}%) | 재고 기반: ${formatCurrency(forecast.inventoryForecast)} | 트렌드 기반: ${formatCurrency(forecast.trendForecast)}`);
    
    // 재고 소진 분석
    const inventoryTurnoverInsight = `현재 재고(${formatCurrency(latest.inventory)})를 평균 회전율(${forecast.avgTurnoverRatio.toFixed(2)})로 계산한 적정 매출입니다.`;
    addAlert('success', '재고 소진 분석', inventoryTurnoverInsight);
    
    // 목표 DOH 기준 적정 매출 정보
    const optimalSalesByTarget = (latest.inventory / TARGET_DOH) * 30;
    const optimalDifference = ((optimalSalesByTarget - forecast.forecast) / forecast.forecast) * 100;
    const optimalComparisonText = optimalDifference >= 0 
        ? `AI 예측보다 ${Math.abs(optimalDifference).toFixed(1)}% 높음` 
        : `AI 예측보다 ${Math.abs(optimalDifference).toFixed(1)}% 낮음`;
    addAlert('info', `목표 ${TARGET_DOH}일 기준 적정 매출`, 
        `${formatCurrency(optimalSalesByTarget)} (${optimalComparisonText}) | 현재 재고를 ${TARGET_DOH}일 동안 소진하려면 이 수준의 매출이 필요합니다.`);
    
    // 동적 임계값 계산 (TARGET_DOH 기준)
    const excessThreshold = Math.round(TARGET_DOH * 1.5); // 목표의 150%
    const shortageThreshold = Math.round(TARGET_DOH * 0.5); // 목표의 50%
    
    // 재고 과다 경고
    if (latest.doh > excessThreshold) {
        addAlert('warning', '재고 과다 경고', 
            `현재 소진율이 ${latest.doh.toFixed(1)}일로 적정 수준(목표 ${TARGET_DOH}일, 상한 ${excessThreshold}일)을 초과했습니다. 재고 관리가 필요합니다.`);
    }
    
    // 재고 부족 경고
    if (latest.doh < shortageThreshold) {
        addAlert('danger', '재고 부족 경고', 
            `현재 소진율이 ${latest.doh.toFixed(1)}일로 매우 낮습니다(목표 ${TARGET_DOH}일, 하한 ${shortageThreshold}일). 품절 위험이 있으니 긴급 발주가 필요합니다.`);
    }
    
    // 매출 증가/감소 알림
    if (latest.momGrowth !== null) {
        if (latest.momGrowth > 10) {
            addAlert('success', '최근 매출 증가', 
                `전월 대비 매출이 ${latest.momGrowth.toFixed(1)}% 증가했습니다. ${nextMonthFormatted} 재고 확보에 주의하세요.`);
        } else if (latest.momGrowth < -10) {
            addAlert('warning', '최근 매출 감소', 
                `전월 대비 매출이 ${Math.abs(latest.momGrowth).toFixed(1)}% 감소했습니다. 원인 분석이 필요합니다.`);
        }
    }
    
    // 적정 재고 추천 (TARGET_DOH 사용)
    const optimalInventory = (forecast.forecast / 30) * TARGET_DOH;
    const inventoryDiff = ((optimalInventory - latest.inventory) / latest.inventory) * 100;
    if (Math.abs(inventoryDiff) > 10) {
        addAlert('info', `${nextMonthFormatted} 재고 최적화 제안`, 
            `적정 재고 수준: ${formatCurrency(optimalInventory)} (목표 ${TARGET_DOH}일 기준, 현재 대비 ${inventoryDiff >= 0 ? '+' : ''}${inventoryDiff.toFixed(1)}%)`);
    }
}

function addAlert(type, title, message) {
    const alertsContainer = document.getElementById('alertsContainer');
    const icons = {
        warning: 'fa-exclamation-triangle',
        danger: 'fa-exclamation-circle',
        success: 'fa-check-circle',
        info: 'fa-info-circle'
    };
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <div class="alert-content">
            <h4>${title}</h4>
            <p>${message}</p>
        </div>
    `;
    alertsContainer.appendChild(alertDiv);
}

// ===== Create Charts =====
function createCharts() {
    createSalesTrendChart();
    createForecastChart();
    createInventoryChart();
    createMetricsChart();
}

function createSalesTrendChart() {
    const ctx = document.getElementById('salesTrendChart').getContext('2d');
    
    // 기존 차트 제거
    if (charts.salesTrend) {
        charts.salesTrend.destroy();
    }
    
    charts.salesTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: processedData.map(d => d.date),
            datasets: [{
                label: '매출액',
                data: processedData.map(d => d.sales),
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '매출액: ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return formatCurrencyShort(value);
                        }
                    }
                }
            }
        }
    });
}

function createForecastChart() {
    const ctx = document.getElementById('forecastChart').getContext('2d');
    
    if (charts.forecast) {
        charts.forecast.destroy();
    }
    
    // 과거 데이터 (최근 6개월)
    const historical = processedData.slice(-6);
    const forecast = forecastNextMonth(processedData);
    
    // 다음 달 날짜 생성
    const lastDate = new Date(historical[historical.length - 1].date);
    lastDate.setMonth(lastDate.getMonth() + 1);
    const nextMonth = lastDate.toISOString().slice(0, 7);
    
    charts.forecast = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [...historical.map(d => d.date), nextMonth],
            datasets: [
                {
                    label: '실제 매출',
                    data: [...historical.map(d => d.sales), null],
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'AI 예측',
                    data: [...historical.map(() => null), forecast.forecast],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderDash: [5, 5],
                    tension: 0.4
                },
                {
                    label: '신뢰구간 (상한)',
                    data: [...historical.map(() => null), forecast.upper],
                    borderColor: 'rgba(16, 185, 129, 0.3)',
                    borderDash: [2, 2],
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: '신뢰구간 (하한)',
                    data: [...historical.map(() => null), forecast.lower],
                    borderColor: 'rgba(16, 185, 129, 0.3)',
                    borderDash: [2, 2],
                    fill: '-1',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.parsed.y !== null) {
                                return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return formatCurrencyShort(value);
                        }
                    }
                }
            }
        }
    });
}

function createInventoryChart() {
    const ctx = document.getElementById('inventoryChart').getContext('2d');
    
    if (charts.inventory) {
        charts.inventory.destroy();
    }
    
    charts.inventory = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: processedData.map(d => d.date),
            datasets: [
                {
                    label: '재고금액',
                    data: processedData.map(d => d.inventory),
                    backgroundColor: '#8b5cf6',
                    borderColor: '#7c3aed',
                    borderWidth: 1
                },
                {
                    label: '매출액',
                    data: processedData.map(d => d.sales),
                    backgroundColor: '#2563eb',
                    borderColor: '#1e40af',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrencyShort(value);
                        }
                    }
                }
            }
        }
    });
}

function createMetricsChart() {
    const ctx = document.getElementById('metricsChart').getContext('2d');
    
    if (charts.metrics) {
        charts.metrics.destroy();
    }
    
    charts.metrics = new Chart(ctx, {
        type: 'line',
        data: {
            labels: processedData.map(d => d.date),
            datasets: [
                {
                    label: '재고회전율',
                    data: processedData.map(d => d.turnoverRatio),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    yAxisID: 'y',
                    tension: 0.4
                },
                {
                    label: 'DOH (일)',
                    data: processedData.map(d => d.doh),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    yAxisID: 'y1',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: '재고회전율'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'DOH (일)'
                    },
                    grid: {
                        drawOnChartArea: false,
                    }
                }
            }
        }
    });
}

// ===== Populate Details Table =====
function populateDetailsTable() {
    const tableBody = document.getElementById('detailsTableBody');
    tableBody.innerHTML = '';
    
    processedData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.date}</td>
            <td>${formatCurrency(row.sales)}</td>
            <td>${formatCurrency(row.inventory)}</td>
            <td>${row.turnoverRatio.toFixed(2)}</td>
            <td>${row.doh.toFixed(1)}</td>
            <td>${row.momGrowth !== null ? (row.momGrowth >= 0 ? '+' : '') + row.momGrowth.toFixed(1) + '%' : '-'}</td>
        `;
        tableBody.appendChild(tr);
    });
}

// ===== Download Sample Data =====
function downloadSampleData() {
    const sampleData = generateSampleData();
    const csv = convertToCSV(sampleData);
    downloadCSV(csv, 'sample_data.csv');
}

function generateSampleData() {
    const data = [];
    const startDate = new Date('2024-01-01');
    
    for (let i = 0; i < 18; i++) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + i);
        const dateStr = date.toISOString().slice(0, 7);
        
        // 랜덤한 매출 및 재고 생성 (약간의 트렌드 포함)
        const baseSales = 800000000 + (i * 5000000); // 8억원 기준, 월 500만원 증가
        const variation = (Math.random() - 0.5) * 100000000; // ±1억 변동
        const sales = baseSales + variation;
        
        const inventory = sales * (0.3 + Math.random() * 0.2); // 매출의 30-50%
        
        data.push({
            date: dateStr,
            sales: Math.round(sales),
            inventory: Math.round(inventory)
        });
    }
    
    return data;
}

function convertToCSV(data) {
    const header = '날짜,매출액,재고금액\n';
    const rows = data.map(row => `${row.date},${row.sales},${row.inventory}`).join('\n');
    return header + rows;
}

function downloadCSV(csv, filename) {
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ===== Download Report =====
function downloadReport() {
    const reportData = processedData.map(row => ({
        date: row.date,
        sales: row.sales,
        inventory: row.inventory,
        turnoverRatio: row.turnoverRatio.toFixed(2),
        doh: row.doh.toFixed(1),
        momGrowth: row.momGrowth !== null ? row.momGrowth.toFixed(1) : ''
    }));
    
    // 예측 데이터 추가
    const forecast = forecastNextMonth(processedData);
    const lastDate = new Date(processedData[processedData.length - 1].date);
    lastDate.setMonth(lastDate.getMonth() + 1);
    const nextMonth = lastDate.toISOString().slice(0, 7);
    
    reportData.push({
        date: nextMonth + ' (예측)',
        sales: Math.round(forecast.forecast),
        inventory: '-',
        turnoverRatio: '-',
        doh: '-',
        momGrowth: '-'
    });
    
    const csv = 'date,sales,inventory,turnoverRatio,doh,momGrowth\n' + 
                 reportData.map(row => `${row.date},${row.sales},${row.inventory},${row.turnoverRatio},${row.doh},${row.momGrowth}`).join('\n');
    
    downloadCSV(csv, 'inventory_analysis_report.csv');
}

// ===== Reset App =====
function resetApp() {
    if (confirm('모든 데이터를 초기화하시겠습니까?')) {
        uploadedData = [];
        processedData = [];
        
        // 차트 제거
        Object.values(charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        charts = {};
        
        // UI 초기화
        document.getElementById('fileInput').value = '';
        document.getElementById('dataPreview').style.display = 'none';
        document.getElementById('dashboardSection').style.display = 'none';
        document.getElementById('uploadSection').style.display = 'block';
        document.getElementById('previewTableBody').innerHTML = '';
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// ===== Utility Functions =====
function formatCurrency(value) {
    return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

function formatCurrencyShort(value) {
    if (value >= 100000000) {
        return (value / 100000000).toFixed(1) + '억';
    } else if (value >= 10000) {
        return (value / 10000).toFixed(0) + '만';
    }
    return value.toFixed(0);
}
