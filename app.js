// Cesium Ion API 키 설정
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIzNmMyZTk1OC01ZjY4LTRhZmItYjk2OC0xNDc3NzFjZGQ2MWYiLCJpZCI6MzQyNjc2LCJpYXQiOjE3NjMwMTgzNDR9.09b5SxXK8EU3KJv6BDB-pmJtrNGSyRw6YpaGvAPars4";

// 전역 변수
let viewer;
let shipEntities = [];
let autoRefreshInterval = null;
let isAutoRefresh = false;
let currentShipData = [];

// 선박 유형별 색상
const shipColors = {
    cargo: Cesium.Color.fromCssColorString('#FF6B6B'),
    tanker: Cesium.Color.fromCssColorString('#4ECDC4'),
    passenger: Cesium.Color.fromCssColorString('#45B7D1'),
    fishing: Cesium.Color.fromCssColorString('#96CEB4'),
    other: Cesium.Color.fromCssColorString('#FFEAA7')
};

// 지역별 좌표
const regions = {
    korea: { lon: 127.5, lat: 36.0, height: 1500000 },
    busan: { lon: 129.05, lat: 35.1, height: 100000 },
    incheon: { lon: 126.63, lat: 37.45, height: 100000 },
    ulsan: { lon: 129.38, lat: 35.53, height: 100000 },
    global: { lon: 127.5, lat: 36.0, height: 20000000 }
};

// 샘플 AIS 데이터 (실제 API 연동 전 테스트용)
function generateSampleData() {
    const ships = [];
    const baseLocations = [
        // 부산항 근처
        { lat: 35.1, lon: 129.05, name: "부산항" },
        // 인천항 근처
        { lat: 37.45, lon: 126.63, name: "인천항" },
        // 울산항 근처
        { lat: 35.53, lon: 129.38, name: "울산항" },
        // 목포항 근처
        { lat: 34.78, lon: 126.38, name: "목포항" },
        // 동해 근처
        { lat: 37.5, lon: 129.1, name: "동해" },
        // 제주 근처
        { lat: 33.5, lon: 126.5, name: "제주" },
        // 광양항 근처
        { lat: 34.9, lon: 127.7, name: "광양항" },
        // 평택항 근처
        { lat: 36.97, lon: 126.82, name: "평택항" }
    ];

    const shipNames = [
        "HYUNDAI FORTUNE", "HANJIN SEATTLE", "EVERGREEN MARINE",
        "COSCO PACIFIC", "MSC OSCAR", "MAERSK LINE", "CMA CGM",
        "YANG MING", "PIL PACIFIC", "ONE COMMITMENT",
        "KMTC BUSAN", "SINOKOR INCHEON", "DONGJIN GLORY",
        "HEUNG-A ULSAN", "NAMSUNG PIONEER", "PAN OCEAN STAR",
        "SK ENERGY TANKER", "DONGBANG SPIRIT", "KOREA EXPRESS",
        "SAMSUNG HEAVY", "DAEWOO MARINE", "STX OFFSHORE",
        "HALLA CARRIER", "KUKDONG MARITIME", "KCTC LOGISTICS"
    ];

    const shipTypes = ['cargo', 'tanker', 'passenger', 'fishing', 'other'];
    const destinations = ['BUSAN', 'INCHEON', 'SHANGHAI', 'TOKYO', 'SINGAPORE', 'HONG KONG', 'KAOHSIUNG', 'OSAKA'];

    for (let i = 0; i < 150; i++) {
        const baseLocation = baseLocations[Math.floor(Math.random() * baseLocations.length)];
        const latOffset = (Math.random() - 0.5) * 2;
        const lonOffset = (Math.random() - 0.5) * 2;

        const ship = {
            mmsi: 440000000 + Math.floor(Math.random() * 1000000),
            name: shipNames[Math.floor(Math.random() * shipNames.length)] + " " + (i + 1),
            shipType: shipTypes[Math.floor(Math.random() * shipTypes.length)],
            lat: baseLocation.lat + latOffset,
            lon: baseLocation.lon + lonOffset,
            speed: Math.random() * 20,
            course: Math.random() * 360,
            heading: Math.random() * 360,
            status: Math.random() > 0.3 ? 'UNDERWAY' : 'AT_ANCHOR',
            destination: destinations[Math.floor(Math.random() * destinations.length)],
            eta: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
            length: Math.floor(100 + Math.random() * 300),
            width: Math.floor(15 + Math.random() * 50),
            draught: (5 + Math.random() * 15).toFixed(1),
            callSign: generateCallSign(),
            imo: 9000000 + Math.floor(Math.random() * 1000000),
            timestamp: new Date().toISOString()
        };
        ships.push(ship);
    }
    return ships;
}

function generateCallSign() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let callSign = '';
    for (let i = 0; i < 4; i++) {
        callSign += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return callSign + Math.floor(Math.random() * 10);
}

// Cesium 뷰어 초기화
async function initCesium() {
    // Cesium 뷰어 생성 (해상 지도에 최적화된 설정)
    viewer = new Cesium.Viewer('cesiumContainer', {
        terrainProvider: await Cesium.CesiumTerrainProvider.fromIonAssetId(1),
        baseLayerPicker: true,
        geocoder: true,
        homeButton: true,
        sceneModePicker: true,
        navigationHelpButton: true,
        animation: true,
        timeline: true,
        fullscreenButton: true,
        vrButton: false,
        selectionIndicator: true,
        infoBox: false, // 커스텀 인포박스 사용
        shouldAnimate: true
    });

    // 해상 이미지 레이어 추가 (해양 데이터 강화)
    await addMaritimeLayers();

    // 대기 효과 및 조명 설정
    viewer.scene.globe.enableLighting = true;
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = 0.0001;

    // 바다 색상 강화
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#1a4b77');

    // 수심 효과 (바다 투명도)
    viewer.scene.globe.depthTestAgainstTerrain = true;

    // 카메라 초기 위치 (한국 해역)
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(127.5, 36.0, 1500000),
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-60),
            roll: 0
        },
        duration: 2
    });

    // 클릭 이벤트 핸들러
    viewer.screenSpaceEventHandler.setInputAction(onLeftClick, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 마우스 오버 이벤트
    viewer.screenSpaceEventHandler.setInputAction(onMouseMove, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // 초기 데이터 로드
    loadAISData();

    // 검색 이벤트
    document.getElementById('shipSearch').addEventListener('input', onSearchInput);
    document.getElementById('dataSource').addEventListener('change', onDataSourceChange);
    document.getElementById('shipTypeFilter').addEventListener('change', onFilterChange);
    document.getElementById('regionSelect').addEventListener('change', onRegionChange);
}

// 해상 레이어 추가
async function addMaritimeLayers() {
    try {
        // Bing Maps Aerial with Labels (해상 지역명 표시)
        const bingLayer = await Cesium.IonImageryProvider.fromAssetId(2);
        viewer.imageryLayers.addImageryProvider(bingLayer);

        // 해상 경계선 및 항로 표시를 위한 GeoJSON 레이어 추가
        addMaritimeRoutes();

        // 주요 항구 마커 추가
        addPortMarkers();

    } catch (error) {
        console.warn('일부 해상 레이어를 로드하지 못했습니다:', error);
    }
}

// 주요 해상 항로 표시
function addMaritimeRoutes() {
    // 한국 주요 항로 (간략화)
    const routes = [
        // 부산-인천 항로
        { positions: [[129.05, 35.1], [126.0, 34.5], [125.5, 36.0], [126.63, 37.45]], name: "부산-인천 항로" },
        // 부산-울산 항로
        { positions: [[129.05, 35.1], [129.38, 35.53]], name: "부산-울산 연안" },
        // 부산-제주 항로
        { positions: [[129.05, 35.1], [128.0, 34.0], [126.5, 33.5]], name: "부산-제주 항로" },
        // 인천-중국 항로
        { positions: [[126.63, 37.45], [124.0, 36.0], [122.0, 32.0]], name: "인천-상해 항로" }
    ];

    routes.forEach(route => {
        const positions = route.positions.flatMap(pos => [pos[0], pos[1]]);
        viewer.entities.add({
            name: route.name,
            polyline: {
                positions: Cesium.Cartesian3.fromDegreesArray(positions),
                width: 2,
                material: new Cesium.PolylineDashMaterialProperty({
                    color: Cesium.Color.CYAN.withAlpha(0.5),
                    dashLength: 16.0
                }),
                clampToGround: false
            }
        });
    });
}

// 주요 항구 마커 추가
function addPortMarkers() {
    const ports = [
        { name: "부산항", lon: 129.05, lat: 35.1 },
        { name: "인천항", lon: 126.63, lat: 37.45 },
        { name: "울산항", lon: 129.38, lat: 35.53 },
        { name: "목포항", lon: 126.38, lat: 34.78 },
        { name: "광양항", lon: 127.7, lat: 34.9 },
        { name: "평택항", lon: 126.82, lat: 36.97 },
        { name: "여수항", lon: 127.66, lat: 34.74 },
        { name: "포항항", lon: 129.38, lat: 36.03 }
    ];

    ports.forEach(port => {
        viewer.entities.add({
            name: port.name,
            position: Cesium.Cartesian3.fromDegrees(port.lon, port.lat),
            point: {
                pixelSize: 12,
                color: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            },
            label: {
                text: port.name,
                font: '14px sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -15),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });
    });
}

// AIS 데이터 로드
async function loadAISData() {
    showLoading(true);

    try {
        const dataSource = document.getElementById('dataSource').value;
        let ships;

        if (dataSource === 'sample') {
            // 샘플 데이터 사용
            ships = generateSampleData();
            showNotification('샘플 데이터가 로드되었습니다. (150척)', 'success');
        } else {
            // 실제 AIS API 호출
            ships = await fetchAISData();
        }

        currentShipData = ships;
        displayShips(ships);
        updateStats(ships);

    } catch (error) {
        console.error('AIS 데이터 로드 오류:', error);
        showNotification('데이터 로드 중 오류가 발생했습니다.', 'error');
    } finally {
        showLoading(false);
    }
}

// 실제 AIS API 호출 (예시 - 실제 API에 맞게 수정 필요)
async function fetchAISData() {
    const apiKey = document.getElementById('aisApiKey').value;

    if (!apiKey) {
        showNotification('API 키를 입력해주세요.', 'error');
        return generateSampleData();
    }

    // AIS Hub 또는 다른 AIS API 엔드포인트 예시
    // 실제 사용시 해당 API의 스펙에 맞게 수정 필요
    try {
        // 예시: AISHub API
        // const response = await fetch(`https://data.aishub.net/ws.php?username=${apiKey}&format=1&output=json&compress=0&latmin=33&latmax=39&lonmin=124&lonmax=132`);

        // CORS 문제로 인해 실제 API 호출은 백엔드 프록시 필요
        // 여기서는 샘플 데이터 반환
        showNotification('API 연동은 백엔드 프록시가 필요합니다. 샘플 데이터를 표시합니다.', 'error');
        return generateSampleData();

    } catch (error) {
        console.error('API 호출 오류:', error);
        return generateSampleData();
    }
}

// 선박 표시
function displayShips(ships) {
    // 기존 선박 엔티티 제거
    shipEntities.forEach(entity => {
        viewer.entities.remove(entity);
    });
    shipEntities = [];

    const filter = document.getElementById('shipTypeFilter').value;

    ships.forEach(ship => {
        // 필터 적용
        if (filter !== 'all' && ship.shipType !== filter) {
            return;
        }

        const color = shipColors[ship.shipType] || shipColors.other;
        const isMoving = ship.status === 'UNDERWAY';

        // 선박 모양 (화살표 형태)
        const entity = viewer.entities.add({
            name: ship.name,
            position: Cesium.Cartesian3.fromDegrees(ship.lon, ship.lat, 0),
            properties: {
                shipData: ship
            },
            // 선박 아이콘 (방향 표시)
            billboard: {
                image: createShipIcon(color, ship.heading),
                width: 24,
                height: 24,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
            // 선박명 라벨
            label: {
                text: ship.name,
                font: '11px sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.TOP,
                pixelOffset: new Cesium.Cartesian2(0, 15),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 500000),
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
            // 속도 벡터 (항해 중인 선박만)
            polyline: isMoving ? {
                positions: calculateSpeedVector(ship),
                width: 2,
                material: new Cesium.PolylineArrowMaterialProperty(color.withAlpha(0.7)),
                clampToGround: false
            } : undefined
        });

        shipEntities.push(entity);
    });
}

// 선박 아이콘 생성 (SVG 캔버스)
function createShipIcon(color, heading) {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');

    // 캔버스 중심으로 이동 및 회전
    ctx.translate(20, 20);
    ctx.rotate((heading || 0) * Math.PI / 180);

    // 배 형태 그리기 (위쪽이 선수)
    ctx.beginPath();

    // 선수 (뾰족한 앞부분)
    ctx.moveTo(0, -16);

    // 우현 (오른쪽) - 곡선으로 선체 표현
    ctx.quadraticCurveTo(6, -10, 7, -4);
    ctx.lineTo(7, 6);

    // 선미 (뒷부분) - 평평한 모양
    ctx.lineTo(5, 10);
    ctx.lineTo(-5, 10);

    // 좌현 (왼쪽)
    ctx.lineTo(-7, 6);
    ctx.lineTo(-7, -4);
    ctx.quadraticCurveTo(-6, -10, 0, -16);

    ctx.closePath();

    // 선체 색상 채우기
    ctx.fillStyle = color.toCssColorString();
    ctx.fill();

    // 선체 테두리
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 갑판 (중앙 라인)
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(0, 6);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 선교 (브릿지) - 작은 사각형
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(-3, 0, 6, 5);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-3, 0, 6, 5);

    return canvas.toDataURL();
}

// 속도 벡터 계산
function calculateSpeedVector(ship) {
    const speedScale = ship.speed * 500; // 속도에 따른 벡터 길이
    const headingRad = Cesium.Math.toRadians(ship.heading || ship.course || 0);

    const startPos = Cesium.Cartesian3.fromDegrees(ship.lon, ship.lat, 100);

    // 진행 방향으로 벡터 계산
    const dx = speedScale * Math.sin(headingRad) / 111000;
    const dy = speedScale * Math.cos(headingRad) / 111000;

    const endPos = Cesium.Cartesian3.fromDegrees(
        ship.lon + dx,
        ship.lat + dy,
        100
    );

    return [startPos, endPos];
}

// 클릭 이벤트 핸들러
function onLeftClick(click) {
    const pickedObject = viewer.scene.pick(click.position);

    if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.properties) {
        const shipData = pickedObject.id.properties.shipData.getValue();
        if (shipData) {
            showShipInfo(shipData);
        }
    }
}

// 마우스 오버 이벤트
let hoveredEntity = null;
function onMouseMove(movement) {
    const pickedObject = viewer.scene.pick(movement.endPosition);

    if (hoveredEntity) {
        // 이전 하이라이트 제거
        if (hoveredEntity.billboard) {
            hoveredEntity.billboard.scale = 1.0;
        }
        hoveredEntity = null;
    }

    if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.properties) {
        hoveredEntity = pickedObject.id;
        if (hoveredEntity.billboard) {
            hoveredEntity.billboard.scale = 1.3;
        }
        document.body.style.cursor = 'pointer';
    } else {
        document.body.style.cursor = 'default';
    }
}

// 선박 정보 표시
function showShipInfo(ship) {
    const panel = document.getElementById('shipInfoPanel');
    const content = document.getElementById('shipInfoContent');

    const statusText = ship.status === 'UNDERWAY' ? '항해 중 🟢' : '정박 중 🔴';
    const shipTypeNames = {
        cargo: '화물선',
        tanker: '유조선',
        passenger: '여객선',
        fishing: '어선',
        other: '기타'
    };

    content.innerHTML = `
        <div class="ship-info-row">
            <span class="label">선박명</span>
            <span class="value">${ship.name}</span>
        </div>
        <div class="ship-info-row">
            <span class="label">MMSI</span>
            <span class="value">${ship.mmsi}</span>
        </div>
        <div class="ship-info-row">
            <span class="label">IMO</span>
            <span class="value">${ship.imo || 'N/A'}</span>
        </div>
        <div class="ship-info-row">
            <span class="label">호출부호</span>
            <span class="value">${ship.callSign || 'N/A'}</span>
        </div>
        <div class="ship-info-row">
            <span class="label">선박 유형</span>
            <span class="value">${shipTypeNames[ship.shipType] || '기타'}</span>
        </div>
        <div class="ship-info-row">
            <span class="label">상태</span>
            <span class="value">${statusText}</span>
        </div>
        <div class="ship-info-row">
            <span class="label">위치 (위도)</span>
            <span class="value">${ship.lat.toFixed(5)}°</span>
        </div>
        <div class="ship-info-row">
            <span class="label">위치 (경도)</span>
            <span class="value">${ship.lon.toFixed(5)}°</span>
        </div>
        <div class="ship-info-row">
            <span class="label">속력</span>
            <span class="value">${ship.speed.toFixed(1)} knots</span>
        </div>
        <div class="ship-info-row">
            <span class="label">침로 (COG)</span>
            <span class="value">${(ship.course || 0).toFixed(1)}°</span>
        </div>
        <div class="ship-info-row">
            <span class="label">선수방향 (HDG)</span>
            <span class="value">${(ship.heading || 0).toFixed(1)}°</span>
        </div>
        <div class="ship-info-row">
            <span class="label">목적지</span>
            <span class="value">${ship.destination || 'N/A'}</span>
        </div>
        <div class="ship-info-row">
            <span class="label">예상 도착</span>
            <span class="value">${ship.eta ? new Date(ship.eta).toLocaleString('ko-KR') : 'N/A'}</span>
        </div>
        <div class="ship-info-row">
            <span class="label">선박 크기</span>
            <span class="value">${ship.length}m × ${ship.width}m</span>
        </div>
        <div class="ship-info-row">
            <span class="label">흘수</span>
            <span class="value">${ship.draught}m</span>
        </div>
        <div class="ship-info-row">
            <span class="label">데이터 시간</span>
            <span class="value">${new Date(ship.timestamp).toLocaleString('ko-KR')}</span>
        </div>
    `;

    panel.style.display = 'block';

    // 해당 선박으로 카메라 이동
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(ship.lon, ship.lat, 50000),
        duration: 1.5
    });
}

// 선박 정보 패널 닫기
function closeShipInfo() {
    document.getElementById('shipInfoPanel').style.display = 'none';
}

// 통계 업데이트
function updateStats(ships) {
    const total = ships.length;
    const moving = ships.filter(s => s.status === 'UNDERWAY').length;
    const anchored = total - moving;

    document.getElementById('totalShips').textContent = total;
    document.getElementById('movingShips').textContent = moving;
    document.getElementById('anchoredShips').textContent = anchored;
    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('ko-KR');
}

// 검색 기능
function onSearchInput(e) {
    const query = e.target.value.toLowerCase();
    const resultsContainer = document.getElementById('searchResults');

    if (query.length < 2) {
        resultsContainer.innerHTML = '';
        return;
    }

    const matches = currentShipData.filter(ship =>
        ship.name.toLowerCase().includes(query) ||
        ship.mmsi.toString().includes(query)
    ).slice(0, 10);

    resultsContainer.innerHTML = matches.map(ship => `
        <div class="search-result-item" onclick="selectShip('${ship.mmsi}')">
            <strong>${ship.name}</strong><br>
            <small>MMSI: ${ship.mmsi} | ${ship.shipType}</small>
        </div>
    `).join('');
}

// 선박 선택
function selectShip(mmsi) {
    const ship = currentShipData.find(s => s.mmsi.toString() === mmsi.toString());
    if (ship) {
        showShipInfo(ship);
        document.getElementById('searchResults').innerHTML = '';
        document.getElementById('shipSearch').value = '';
    }
}

// 데이터 소스 변경
function onDataSourceChange(e) {
    const apiKeyGroup = document.getElementById('apiKeyGroup');
    apiKeyGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
}

// 필터 변경
function onFilterChange() {
    displayShips(currentShipData);
}

// 지역 변경
function onRegionChange(e) {
    const region = regions[e.target.value];
    if (region) {
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(region.lon, region.lat, region.height),
            duration: 2
        });
    }
}

// 자동 갱신 토글
function toggleAutoRefresh() {
    isAutoRefresh = !isAutoRefresh;
    document.getElementById('autoRefreshStatus').textContent = isAutoRefresh ? 'ON' : 'OFF';

    if (isAutoRefresh) {
        autoRefreshInterval = setInterval(loadAISData, 60000); // 1분마다 갱신
        showNotification('자동 갱신이 활성화되었습니다. (1분 간격)', 'success');
    } else {
        clearInterval(autoRefreshInterval);
        showNotification('자동 갱신이 비활성화되었습니다.', 'success');
    }
}

// 한국 해역으로 이동
function flyToKorea() {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(127.5, 36.0, 1500000),
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-60),
            roll: 0
        },
        duration: 2
    });
}

// 로딩 표시
function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

// 알림 표시
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = type === 'error' ? 'error' : '';
    notification.style.display = 'block';

    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// 초기화 실행
document.addEventListener('DOMContentLoaded', initCesium);
