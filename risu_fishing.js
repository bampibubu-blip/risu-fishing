//@name risu_fishing
//@api 3.0
//@version 1.1.0
//@update-url https://raw.githubusercontent.com/bampibubu-blip/risu-fishing/main/risu_fishing.js
//@display-name 🎣 리스 낚시터
//@link https://github.com/bampibubu-blip/risu-fishing 사용법과 업데이트
//@link https://github.com/bampibubu-blip/risu-fishing/issues 버그 제보
//@arg image_base string 물고기 그림 폴더 주소. 비워 두면 기본 그림, none을 넣으면 이모지만 써요.

/*
 * 리스 낚시터 v1.1.0 — RisuAI 플러그인 (API v3)
 *
 * AI 답변(메인·보조 모델)을 받을 때마다 미끼가 쌓이고, 채팅 메뉴의 🎣 버튼으로
 * 지금 대화 중인 캐릭터의 세계관에 맞는 낚시터에서 물고기를 낚는다.
 *
 * - 공용 도감 120종 (8지역 × 15종), 이세계 1%, 황금 개체 1/256
 * - 희귀 이상은 릴 감기 미니게임
 * - 업적 22개(숨김 3)와 칭호
 * - 조개(판매·업적 보상), 관상용 수조, 상점, 어탁 이미지 저장
 * - 캐릭터 고유종: 한 캐릭터와 10·50·150번 낚시하면 보조 모델이 그 캐릭터만의 물고기를 한 단계씩 만든다
 * - 모든 기록은 pluginStorage에 저장 (기기 간 동기화), JSON 백업/복원
 */

(async () => {
  // ─────────────────────────────── 데이터 ───────────────────────────────
  const TIERS = [
    { key: 'common',   label: '일반', color: '#8a95a3', weight: 60, window: 800 },
    { key: 'uncommon', label: '고급', color: '#2a8a9c', weight: 25, window: 650 },
    { key: 'rare',     label: '희귀', color: '#5d58c9', weight: 10, window: 500 },
    { key: 'legend',   label: '전설', color: '#c27c0e', weight: 4,  window: 350 },
  ];
  const ISEKAI_RATE = 1;
  // 고유종 단계: 그 캐릭터와 after번 던지면 생기고, 이후 던질 때마다 rate 확률로 걸린다
  const SIG_STAGES = [
    { after: 10,  rate: 0.02,  maxCm: 5000 },
    { after: 50,  rate: 0.015, maxCm: 8000 },
    { after: 150, rate: 0.01,  maxCm: 12000 },
  ];
  const SIG_AFTER = SIG_STAGES[0].after;
  const REROLL_COST = 80;          // % (나머지 99%는 위 가중치대로)
  const GOLDEN_RATE = 1 / 256;
  const START_BAIT = 5;
  // 지역당 배열 순서: 일반 6, 고급 4, 희귀 3, 전설 2
  const TIER_OF_INDEX = [0,0,0,0,0,0,1,1,1,1,2,2,2,3,3];

  const REGIONS = [
    { id: 'fantasy', name: '판타지 호수', icon: '🏰',
      water: ['#e3eff5', '#86b9cf'],
      kw: ['마법','왕국','기사단','엘프','드래곤','마왕','용사','공주','길드','마나석','던전','마법사','magic','kingdom','knight','elf','elves','dragon','demon lord','princess','guild','dungeon','fantasy','wizard','sorcer'],
      fish: [
        ['🐟','마나 송사리',3,8,'물속에서 희미하게 빛난다'],
        ['🐸','개구리 왕자(아님)',5,12,'키스해도 그냥 개구리'],
        ['🐟','은비늘 붕어',10,25,'기사단 식당 단골 메뉴'],
        ['🍄','둥둥 버섯',4,10,'먹으면 몸이 커질 것 같다'],
        ['📜','젖은 의뢰서',15,30,'보상: 은화 3닢'],
        ['🗡️','녹슨 초보자 검',40,70,'누군가의 첫 모험'],
        ['🐠','엘프귀 잉어',30,60,'칭찬하면 귀가 붉어진다'],
        ['🦀','방패게',15,35,'등딱지에 가문 문장'],
        ['🐡','포션 복어',20,40,'부풀면 체력 회복 냄새'],
        ['🐍','마도 장어',60,120,'지팡이 대용으로 인기'],
        ['🐉','아기용 비늘잉어',50,90,'재채기하면 불꽃'],
        ['🦑','마왕군 정찰 오징어',40,80,'보고서를 먹물로 쓴다'],
        ['🧜','인어의 머리빗',20,30,'아직 머리카락이 감겨 있다'],
        ['🐋','호수의 여신 메기',150,300,'금도끼냐 은도끼냐 묻는다'],
        ['✨','성검 꽂힌 붕어',80,120,'바위 대신 붕어에 꽂혀 있다'],
      ] },
    { id: 'city', name: '도시 운하', icon: '🌃',
      water: ['#e7e6ef', '#8f98bd'],
      kw: ['회사','직장','아파트','도시','편의점','지하철','아이돌','재벌','본부장','연예인','현대','마피아','조직','경찰','형사','병원','의사','군인','스마트폰','러시아','모스크바','미국','뉴욕','서울','도쿄','office','company','apartment','city','idol','ceo','celebrity','subway','modern','contemporary','mafia','bratva','police','detective','hospital','doctor','smartphone','russia','moscow','new york','seoul','tokyo'],
      fish: [
        ['🐟','출근길 피라미',5,10,'늘 지쳐 보인다'],
        ['🐟','야근 숭어',20,40,'눈 밑이 거뭇하다'],
        ['🐌','네온 다슬기',2,5,'간판 불빛을 먹고 산다'],
        ['🛍️','편의점 비닐봉지',20,40,'1+1 영수증이 들어 있다'],
        ['🥫','찌그러진 캔커피',10,15,'아직 미지근하다'],
        ['🪪','누군가의 사원증',8,9,'사진이 잘 나왔다'],
        ['🐠','라떼아트 금붕어',10,20,'등에 하트 무늬'],
        ['🐟','칼퇴 연어',50,80,'6시 정각에만 거슬러 오른다'],
        ['🐢','택배 거북',25,45,'등에 송장이 붙어 있다'],
        ['🚲','공용 자전거 바퀴',50,70,'대여 시간 초과 중'],
        ['🐡','월급 복어',30,50,'들어오자마자 쪼그라든다'],
        ['🎤','응원봉 해파리',30,60,'노래에 맞춰 색이 바뀐다'],
        ['🦈','재벌 3세 상어',100,200,'본부장님이라 불러야 한다'],
        ['🐉','운하 괴물 잉어',200,400,'목격담만 무성했던 그것'],
        ['✨','로또 1등 금붕어',15,25,'놓치면 평생 후회'],
      ] },
    { id: 'school', name: '학교 수영장', icon: '🏫',
      water: ['#e6f4f8', '#62bcd8'],
      kw: ['학교','학생','교실','선배','후배','동아리','학원물','축제','반장','선생님','대학','기숙사','고등학','school','student','classroom','senpai','teacher','academy','university','college','dormitory','high school'],
      fish: [
        ['🐟','지각 송사리',3,7,'식빵을 물고 있다'],
        ['🐟','매점빵 붕어',10,20,'4교시 끝나면 사라진다'],
        ['🐸','과학실 개구리',6,12,'해부는 면했다'],
        ['🧢','수영모',10,20,'이름이 매직으로 적혀 있다'],
        ['📄','빵점 시험지',21,30,'부모님 사인란이 비어 있다'],
        ['🩴','짝 잃은 실내화',22,28,'뒤꿈치가 꺾여 있다'],
        ['🐠','반장 열대어',8,15,'출석을 부른다'],
        ['🐟','체육복 고등어',30,50,'등에 학번이 있다'],
        ['🦆','동아리 오리',30,45,'가입 신청서를 내민다'],
        ['💌','젖은 러브레터',15,20,'이름이 번져 안 보인다'],
        ['🐡','수학여행 복어',25,40,'밤새 베개싸움 중'],
        ['🐟','옥상 고백 잉어',40,70,'할 말이 있다며 기다린다'],
        ['🦈','학생회장 상어',120,180,'교칙 위반을 적발한다'],
        ['🐋','훈화 말씀 고래',300,500,'말이 끝나지 않는다'],
        ['✨','졸업장 금붕어',20,30,'3년의 무게'],
      ] },
    { id: 'space', name: '우주 성운', icon: '🌌',
      water: ['#e9e7f3', '#7a74ad'],
      kw: ['우주','함선','행성','로봇','안드로이드','사이버','인공지능','외계인','함장','성간','space','spaceship','starship','planet','robot','android','cyborg','cyberpunk','artificial intelligence','alien','sci-fi','mecha','galaxy'],
      fish: [
        ['🐟','별가루 플랑크톤',1,3,'한 움큼에 은하 하나'],
        ['🐟','궤도 정어리',10,20,'90분마다 지구를 돈다'],
        ['🐟','무중력 멸치',4,9,'헤엄치는 방향이 없다'],
        ['🔩','떠도는 나사',2,8,'어느 함선의 부품일까'],
        ['🛰️','위성 파편',30,60,'아직 신호를 보낸다'],
        ['🧃','우주식량 튜브',12,18,'맛: 불고기(라고 적힘)'],
        ['🐠','홀로그램 열대어',10,25,'만지면 지지직'],
        ['🤖','안드로이드 가재',20,40,'감정 모듈 테스트 중'],
        ['🐙','외계 문어',40,90,'우호의 촉수를 내민다'],
        ['🌠','유성 날치',30,50,'소원 빌기 전에 지나간다'],
        ['🦑','블랙홀 오징어',60,120,'먹물이 빛까지 삼킨다'],
        ['🐡','초신성 복어',50,80,'부풀면 위험하다'],
        ['🛸','미확인 비행 가자미',40,70,'정부가 존재를 부정한다'],
        ['🐋','은하수 고래',1000,3000,'등에 별자리가 있다'],
        ['✨','특이점 금붕어',0,999,'잴 때마다 크기가 다르다'],
      ] },
    { id: 'murim', name: '무협 계곡', icon: '⛩️',
      water: ['#e7efe8', '#80ad95'],
      kw: ['무림','강호','문파','내공','협객','황제','궁궐','조선','도사','요괴','무협','사극','murim','martial art','wuxia','cultivation','emperor','imperial palace','joseon','taoist','yokai'],
      fish: [
        ['🐟','하산 피라미',4,9,'사부 몰래 내려왔다'],
        ['🐟','대나무 붕어',15,25,'마디마다 비늘'],
        ['🐸','경공 개구리',5,10,'한 번 뛰면 십 리'],
        ['🍃','찢어진 비급',15,25,'핵심 페이지만 없다'],
        ['🥢','젓가락 한 짝',20,23,'객잔에서 흘러왔다'],
        ['🍵','식은 찻잔',7,10,'누군가 결투하러 갔다'],
        ['🐠','내공 잉어',30,60,'물보라에 기가 실렸다'],
        ['🦀','철포삼 게',20,35,'칼이 안 들어간다'],
        ['🐟','주화입마 메기',50,90,'눈이 시뻘겋다'],
        ['🐢','장문인 거북',40,70,'백 년째 폐관수련 중'],
        ['🐍','이무기 장어',150,300,'천 년만 더 버티면 용'],
        ['🗡️','천하제일검 꽁치',30,40,'날이 서 있다'],
        ['🦊','구미호 금붕어',20,35,'꼬리지느러미가 아홉 갈래'],
        ['🐲','등용문 잉어',200,400,'폭포를 거슬러 올랐다'],
        ['✨','옥새 문 붕어',30,50,'황실이 발칵 뒤집혔다'],
      ] },
    { id: 'deep', name: '심해', icon: '🌊',
      water: ['#dfebf2', '#4d86a8'],
      kw: ['바다','해적','무인도','항구','인어','선장','항해','해변','선박','해군','리조트','ocean','pirate','island','harbor','mermaid','sailor','voyage','beach','navy'],
      fish: [
        ['🐟','눈 없는 정어리',8,15,'빛을 본 적이 없다'],
        ['🐟','아귀 새끼',10,20,'등불이 아직 꼬마전구'],
        ['🦐','투명 새우',3,8,'있는지 없는지'],
        ['🐚','빈 소라껍데기',5,15,'귀에 대면 파도 소리'],
        ['🪸','부러진 산호',10,30,'다시 자랄 거다'],
        ['🏴‍☠️','해적 안대',8,12,'사실 양쪽 눈 다 멀쩡'],
        ['🐡','초롱아귀',30,60,'등불로 길을 안내한다'],
        ['🦀','키다리게',100,300,'다리 길이 포함'],
        ['🐙','보물지도 문어',40,80,'먹물로 X 표시'],
        ['🐟','침몰선 대구',50,90,'선장 모자를 썼다'],
        ['🦑','대왕오징어',500,1300,'배 아래를 지나갔다'],
        ['🔱','삼지창 꼬리 장어',120,200,'해신의 애완동물'],
        ['💎','보물상자 게',40,70,'열어보면 반은 모래'],
        ['🐙','크라켄',1500,4000,'배 한 척을 끌고 왔다'],
        ['✨','심해의 빛 해파리',50,150,'보는 사람마다 색이 다르다'],
      ] },
    { id: 'ruin', name: '폐허 늪', icon: '🧟',
      water: ['#eceee4', '#94a07a'],
      kw: ['좀비','아포칼립스','멸망','폐허','생존자','호러','괴담','저주','귀신','뱀파이어','감염','zombie','apocalypse','post-apocalyptic','survivor','horror','cursed','ghost','vampire','infected','undead'],
      fish: [
        ['🐟','좀비 피라미',4,10,'죽었는데 팔딱인다'],
        ['🐟','방사능 미꾸라지',15,25,'살짝 초록빛'],
        ['🦴','정체불명의 뼈',10,40,'묻지 않는 게 좋다'],
        ['🥫','유통기한 지난 통조림',8,12,'그래도 귀한 식량'],
        ['🧸','낡은 곰인형',20,35,'눈이 하나 없다'],
        ['🕯️','꺼진 양초',8,15,'방금까지 타고 있었다'],
        ['🐠','저주받은 금붕어',10,20,'어항에서 목소리가 난다'],
        ['🦇','박쥐날개 가오리',50,100,'밤에만 수면 위로'],
        ['🐸','늪지 두꺼비 군주',20,35,'작은 왕관을 썼다'],
        ['🐟','생존자 메기',60,100,'통조림 따개를 물고 있다'],
        ['🧛','뱀파이어 장어',80,140,'햇빛을 보면 재가 된다'],
        ['👁️','눈알 복어',20,40,'계속 쳐다본다'],
        ['📼','저주의 비디오테이프',18,20,'7일 뒤 다시 낚인다'],
        ['🐊','늪의 주인',400,700,'늪 자체가 움직였다'],
        ['✨','마지막 희망 송사리',3,5,'작지만 살아 있다'],
      ] },
    { id: 'dream', name: '꿈속 연못', icon: '🍰',
      water: ['#f4eaf1', '#c3a5d1'],
      kw: ['일상물','힐링','고양이','강아지','동물','동화','요정','디저트','귀여운','카페','slice of life','healing','kitten','puppy','fairy','fairytale','dessert','cozy','cafe'],
      fish: [
        ['🐟','솜사탕 송사리',3,7,'물에 녹는다'],
        ['🐟','낮잠 붕어',10,20,'낚여도 안 깬다'],
        ['🐌','마카롱 달팽이',3,6,'껍질이 바삭하다'],
        ['🍬','사탕 껍질',5,8,'딸기맛이었다'],
        ['🧦','짝 잃은 양말',20,30,'세탁기 너머의 세계에서'],
        ['🫧','비눗방울',1,30,'낚자마자 터질 수도'],
        ['🐠','무지개 구피',4,8,'일곱 색이 다 있다'],
        ['🐱','냥어',30,50,'참치를 좋아하는 물고기'],
        ['🍮','푸딩 해파리',10,20,'흔들흔들'],
        ['🦆','고무오리 대장',10,15,'욕조 세계의 지배자'],
        ['🦄','유니콘 해마',15,30,'뿔에서 반짝이가 떨어진다'],
        ['🌙','달조각 잉어',40,70,'밤에만 보인다'],
        ['🎂','생일 케이크 복어',25,40,'초를 불어줘야 한다'],
        ['🐋','꿈을 먹는 고래',300,600,'좋은 꿈만 골라 먹는다'],
        ['✨','소원별 금붕어',10,20,'소원 하나쯤 들어줄 것 같다'],
      ] },
  ];
  const REGION_BY_ID = Object.fromEntries(REGIONS.map(r => [r.id, r]));
  const TOTAL_SPECIES = REGIONS.reduce((a, r) => a + r.fish.length, 0);
  // 업적: hint는 달성 전, desc는 달성 후 보여준다. hidden이면 달성 전엔 이름도 숨긴다.
  const ACHIEVEMENTS = [
    { id: 'first',    name: '첫 손맛',          title: '초보 낚시꾼',   hint: '무엇이든 하나 낚아보세요',          desc: '처음으로 물고기를 낚았어요',             test: s => s.counters.catches >= 1 },
    { id: 'trophy',   name: '월척',             title: '월척 사냥꾼',   hint: '아주 큰 물고기가 있어요',            desc: '크기 범위 상위 5% 안의 개체를 낚았어요',  test: s => s.counters.trophy >= 1 },
    { id: 'heartbrk', name: '놓친 고기가 크다', title: '아쉬움의 달인', hint: '전설은 쉽게 잡히지 않아요',          desc: '전설 등급 릴 감기에 3번 연속 실패했어요', test: s => s.counters.legendFailStreakMax >= 3 },
    { id: 'complete', name: '그물 장인',        title: '그물 장인',     hint: '한 지역을 끝까지',                   desc: '한 지역의 15종을 모두 모았어요',          test: s => REGIONS.some(r => r.fish.every((_, i) => s.dex[`${r.id}:${i}`])) },
    { id: 'isekai',   name: '차원 낚시꾼',      title: '차원 낚시꾼',   hint: '가끔 다른 세계의 물고기가 걸려요',   desc: '다른 세계의 물고기를 5번 낚았어요',       test: s => s.counters.isekai >= 5 },
    { id: 'golden',   name: '반짝이는 것',      title: '황금손',        hint: '아주 드물게 빛나는 개체가 있어요',   desc: '황금 개체를 낚았어요',                    test: s => s.counters.golden >= 1 },
    { id: 'fake',     name: '헛손질',           title: '잘 속는 사람',  hint: '속는 것도 경험이에요',               desc: '가짜 입질에 10번 속았어요',               test: s => s.counters.fake >= 10 },
    { id: 'cast100',  name: '손목 단련',        title: '백 번 던진 사람', hint: '많이 던져보세요',                  desc: '낚싯대를 100번 던졌어요',                 test: s => s.counters.casts >= 100 },
    { id: 'translate',name: '통역사의 손목',    title: '통역사',        hint: '번역 기능을 아주 많이',              desc: '번역을 1,000번 받았어요',                 test: s => s.counters.translate >= 1000 },
    { id: 'memory',   name: '기억의 정원사',    title: '기억의 정원사', hint: '긴 이야기는 요약이 필요해요',        desc: '메모리 요약을 100번 받았어요',            test: s => s.counters.memory >= 100 },
    { id: 'emotion',  name: '감정 해독가',      title: '감정 해독가',   hint: '감정을 읽는 기능을 써보세요',        desc: '감정 판별을 500번 받았어요',              test: s => s.counters.emotion >= 500 },
    { id: 'rich',     name: '미끼 부자',        title: '미끼 부자',     hint: '미끼를 아껴 모아보세요',             desc: '미끼를 500개 모았어요',                   test: s => s.bait >= 500 },
    { id: 'owl',      name: '올빼미',           title: '올빼미',        hint: '모두가 잠든 시간',                   desc: '새벽 3시에서 5시 사이에 답변을 받았어요', test: s => s.counters.mainNight >= 1 },
    { id: 'longchat', name: '장기 연애',        title: '한 우물 파는 사람', hint: '한 채팅방에서 오래오래',         desc: '한 채팅방에서 500턴을 넘겼어요',          test: s => s.counters.maxTurns >= 500 },
    { id: 'novel',    name: '대하소설',         title: '대하소설가',    hint: '아주 긴 답변',                       desc: '5,000자가 넘는 답변을 받았어요',          test: s => s.counters.longestReply >= 5000 },
    { id: 'sell1',    name: '첫 장사',          title: '어시장 새내기', hint: '낚은 물고기는 팔 수도 있어요',       desc: '처음으로 물고기를 팔았어요',              test: s => s.counters.sold >= 1 },
    { id: 'spender',  name: '큰손',             title: '큰손',          hint: '상점을 자주 이용해 보세요',          desc: '상점에서 조개를 1,000개 썼어요',          test: s => s.counters.shellsSpent >= 1000 },
    { id: 'sig1',     name: '나만의 물고기',    title: '단골 손님',     hint: '오래 함께한 캐릭터의 낚시터에는…',  desc: '캐릭터 고유종을 처음 낚았어요',           test: s => Object.keys(s.sigDex).length >= 1 },
    { id: 'sig3',     name: '낚시터의 주인',    title: '낚시터의 주인', hint: '오래 함께할수록 더 깊은 곳의 물고기가…', desc: '3단계 고유종을 낚았어요',             test: s => Object.keys(s.sigDex).some(k => s.sigs[k.slice(4)]?.stage === 3) },
    { id: 'deja',     name: '데자뷰',           title: '데자뷰',        hidden: true, desc: '같은 물고기를 3번 연속으로 낚았어요', test: s => s.counters.sameStreakMax >= 3 },
    { id: 'midnight', name: '자정의 낚시꾼',    title: '자정의 낚시꾼', hidden: true, desc: '밤 12시 정각에 낚싯대를 던졌어요',  test: s => s.counters.midnight >= 1 },
    { id: 'nobait',   name: '빈손 낚시',        title: '빈손 낚시꾼',   hidden: true, desc: '미끼 없이 던지기를 10번 눌렀어요', test: s => s.counters.emptyTaps >= 10 },
  ];
  const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
  const achReward = a => a.hidden ? 50 : 20;

  // ── 상점
  const ROD = [ // 낚싯대 단계: 챔질 판정 시간 배수, 릴 초록 구간 양쪽 확장
    { name: '대나무 낚싯대', win: 1.0, zone: 0 },
    { name: '유리섬유 낚싯대', win: 1.1, zone: 2, cost: 50 },
    { name: '카본 낚싯대', win: 1.2, zone: 4, cost: 150 },
    { name: '장인의 낚싯대', win: 1.3, zone: 6, cost: 400 },
  ];
  const CHUM = { cost: 30, uses: 5, mult: 1.5 };     // 떡밥: 5회 동안 희귀·전설 확률 1.5배
  const TICKET_COST = 20;                            // 지역 이동권
  const TANK_STEP = 10, TANK_MAX = 100;              // 수조 확장
  const tankCost = cap => 40 + (cap - 30) * 2;
  const SHOP_TITLES = [
    { id: 'shell',  title: '조개 수집가', cost: 100 },
    { id: 'doctor', title: '물고기 박사', cost: 250 },
    { id: 'noble',  title: '낚시 귀족',   cost: 600 },
  ];
  // 판매가: 등급 기본값 × 크기 보정(0.8~1.2) × 황금 5배 × 이세계 1.5배
  const BASE_PRICE = [2, 5, 15, 50];
  function priceOf(it) {
    const info = itemInfo(it); if (!info) return 1;
    const f = info.f, tier = info.tier;
    const rel = f[3] > f[2] ? Math.min(1, Math.max(0, (it.s - f[2]) / (f[3] - f[2]))) : 0.5;
    return Math.max(1, Math.round(BASE_PRICE[tier] * (info.sig ? 1 + (info.stage || 1) : 1) * (0.8 + rel * 0.4) * (it.g ? 5 : 1) * (it.i ? 1.5 : 1)));
  }
  function titleName(id) {
    if (!id) return null;
    if (id.startsWith('shop:')) { const t = SHOP_TITLES.find(x => 'shop:' + x.id === id); return t && state.shopTitles.includes(t.id) ? t.title : null; }
    return state.ach[id] ? ACH_BY_ID[id]?.title : null;
  }

  // 릴 감기 난이도 (희귀·전설만)
  const REEL = {
    2: { zone: [30, 72], need: 3.0, yank: [12, 22], every: [0.7, 1.4] },
    3: { zone: [38, 66], need: 4.5, yank: [16, 28], every: [0.5, 1.1] },
  };

  const AUX_LABELS = { translate: '번역', memory: '메모리', emotion: '감정', otherAx: '기타 보조', submodel: '서브 모델' };

  // ─────────────────────────────── 상태 ───────────────────────────────
  const STORAGE_KEY = 'state_v1';
  const defaultState = () => ({
    v: 1,
    bait: START_BAIT,
    counters: {
      translate: 0, memory: 0, emotion: 0, otherAx: 0, submodel: 0,
      main: 0, mainNight: 0, longestReply: 0, maxTurns: 0,
      casts: 0, catches: 0, miss: 0, early: 0, fake: 0, golden: 0, isekai: 0,
      trophy: 0, reelFail: 0, legendFailStreak: 0, legendFailStreakMax: 0,
      sameStreak: 0, sameStreakMax: 0, midnight: 0, emptyTaps: 0,
      sold: 0, shellsEarned: 0, shellsSpent: 0,
    },
    regions: {},   // chaId -> { r, name }
    dex: {},       // "regionId:idx" -> { n, best, g }
    settings: { sound: true, vibrate: true },
    ach: {},        // 업적 id -> 달성 시각
    unseen: [],     // 아직 알림을 못 본 업적
    title: null,    // 장착한 칭호(업적 id)
    lastCatch: null,
    shells: 0,
    tank: [],       // { k:'지역:번호', s:크기, g:황금, i:이세계, t:시각, c:캐릭터 이름 }
    tankCap: 30,
    gear: { rod: 0, chum: 0, tickets: 1, rerolls: 0 },
    shopTitles: [],
    achPaid: {},    // 조개 보상을 이미 받은 업적
    charCasts: {},  // 캐릭터별 던진 횟수
    sigs: {},       // 캐릭터 id -> 고유종 { emoji, name, desc, min, max, charName, region, at }
    sigDex: {},     // 'sig:캐릭터 id' -> { n, best, g }
    createdAt: Date.now(),
  });


  let state = defaultState();
  try {
    const raw = await Risuai.pluginStorage.getItem(STORAGE_KEY);
    if (raw) state = mergeState(JSON.parse(raw));
  } catch (e) { console.log('[낚시터] 상태 불러오기 실패: ' + e.message); }

  function mergeState(s) {
    const d = defaultState();
    if (!s || typeof s !== 'object' || s.v !== 1) return d;
    return {
      ...d, ...s,
      counters: { ...d.counters, ...(s.counters || {}) },
      settings: { ...d.settings, ...(s.settings || {}) },
      regions: s.regions || {},
      dex: s.dex || {},
      ach: s.ach || {},
      unseen: Array.isArray(s.unseen) ? s.unseen : [],
      tank: Array.isArray(s.tank) ? s.tank : [],
      gear: { ...d.gear, ...(s.gear || {}) },
      shopTitles: Array.isArray(s.shopTitles) ? s.shopTitles : [],
      achPaid: s.achPaid || {},
      charCasts: s.charCasts || {},
      sigs: s.sigs || {},
      sigDex: s.sigDex || {},
    };
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try { await Risuai.pluginStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
      catch (e) { console.log('[낚시터] 저장 실패: ' + e.message); }
    }, 400);
  }

  // ─────────────────────────────── 업적 ───────────────────────────────
  let visible = false;
  function checkAch() {
    const got = [];
    for (const a of ACHIEVEMENTS) {
      if (state.ach[a.id]) continue;
      let ok = false;
      try { ok = a.test(state); } catch (_) {}
      if (ok) { state.ach[a.id] = Date.now(); got.push(a.id); }
    }
    payAchRewards();
    if (!got.length) return;
    save();
    if (visible) got.forEach(id => toast(ACH_BY_ID[id]));
    else { state.unseen.push(...got); updateBadge(); }
  }

  function payAchRewards() {
    let paid = false;
    for (const id of Object.keys(state.ach)) {
      if (state.achPaid[id] || !ACH_BY_ID[id]) continue;
      addShells(achReward(ACH_BY_ID[id])); state.achPaid[id] = true; paid = true;
    }
    if (paid) save();
  }
  function addShells(n) { state.shells += n; state.counters.shellsEarned += n; refreshHud(); }
  function spend(n) {
    if (state.shells < n) return false;
    state.shells -= n; state.counters.shellsSpent += n; save(); refreshHud(); checkAch(); return true;
  }

  // 플러그인 창이 닫혀 있을 때 새 업적이 생기면 채팅 메뉴 버튼 이름에 표시
  let badgeShown = -1;
  async function updateBadge() {
    const n = state.unseen.length;
    if (n === badgeShown) return;
    badgeShown = n;
    try {
      await Risuai.registerButton(
        { name: n ? `낚시하기 (새 업적 ${n})` : '낚시하기', icon: '🎣', iconType: 'html', location: 'chat', id: 'risu-fishing-cast' },
        () => open('fish'));
    } catch (_) {}
  }

  // ─────────────────────────────── 집계 훅 ───────────────────────────────
  // 'pending' | 'on' | 'off' — 권한 요청은 버튼 등록 뒤에 비동기로 처리 (로딩이 멈추지 않게)
  let hookState = 'pending';

  const onAfterRequest = async (content, type) => {
    try {
      // 'model'은 메인 채팅. 메인은 채팅 리스너에서 따로 센다.
      if (type && type !== 'model') {
        state.bait += 1;
        state.counters[type] = (state.counters[type] || 0) + 1;
        save();
        refreshHud();
        checkAch();
      }
    } catch (_) {}
    return content;
  };

  const onChatOutput = async ({ chat, messageIndex }) => {
    try {
      state.counters.main += 1;
      state.bait += 1;
      refreshHud();
      const h = new Date().getHours();
      if (h >= 3 && h < 5) state.counters.mainNight += 1;
      const msg = chat?.message?.[messageIndex];
      if (msg?.data) state.counters.longestReply = Math.max(state.counters.longestReply, msg.data.length);
      const turns = chat?.message?.length || 0;
      state.counters.maxTurns = Math.max(state.counters.maxTurns, turns);
      save();
      checkAch();
    } catch (_) {}
  };

  // ─────────────────────────────── 지역 배정 ───────────────────────────────
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  const CLASSIFY_VERSION = 2;
  // 영어 키워드는 단어 경계로, 한국어는 부분 일치로 센다 (예: 'ai'가 'said'에 걸리지 않게)
  const KW_MATCHERS = REGIONS.map(r => r.kw.map(k => /[a-z]/i.test(k)
    ? new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}`, 'gi')
    : k));
  function countKw(text, m) {
    if (typeof m === 'string') { let n = 0, i = 0; while ((i = text.indexOf(m, i)) !== -1) { n++; i += m.length; } return n; }
    return (text.match(m) || []).length;
  }
  function classify(char) {
    const text = [char.name, char.desc, char.personality, char.scenario, (char.tags || []).join(' ')]
      .filter(Boolean).join(' ').toLowerCase();
    const scores = KW_MATCHERS.map(list => list.reduce((sum, m) => sum + countKw(text, m), 0));
    const max = Math.max(...scores);
    // 아무것도 안 걸리면 현대물로 본다 (가장 흔한 장르)
    if (max === 0) return 'city';
    const cands = REGIONS.filter((_, i) => scores[i] === max);
    return cands[hashStr(char.chaId || char.name || 'x') % cands.length].id;
  }

  async function currentSpot() {
    let char = null;
    try { char = await Risuai.getCharacter(); } catch (_) {}
    if (!char) return { regionId: 'dream', charName: null, isNew: false };
    const id = char.chaId || char.name;
    let isNew = false;
    const saved = state.regions[id];
    // 처음 보는 캐릭터이거나, 예전 분류 방식으로 자동 배정된 캐릭터면 다시 분류 (직접 고른 건 유지)
    if (!saved || (!saved.manual && saved.cv !== CLASSIFY_VERSION)) {
      const r = char.type === 'group' ? 'city' : classify(char);
      state.regions[id] = { r, name: char.name || '이름 없음', cv: CLASSIFY_VERSION };
      isNew = !saved;
      save();
    }
    return { regionId: state.regions[id].r, charName: char.name || '이름 없음', charId: id, isNew };
  }

  // ─────────────────────────────── 낚시 로직 ───────────────────────────────
  function rollTier(chum) {
    const w = TIERS.map((t, i) => t.weight * (chum && i >= 2 ? CHUM.mult : 1));
    const total = w.reduce((a, b) => a + b, 0);
    let x = Math.random() * total;
    for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return i; }
    return 0;
  }

  function rollCatch(regionId) {
    if (spot.charId) {
      for (let st = 3; st >= 1; st--) { // 높은 단계부터 따로 굴린다
        const id = sigId(spot.charId, st), sg = state.sigs[id];
        if (!sg) continue;
        if (Math.random() < SIG_STAGES[st - 1].rate) {
          return { rid: regionId, sig: 'sig:' + id, stage: st, tier: 3, emoji: sg.emoji, name: sg.name, min: sg.min, max: sg.max, desc: sg.desc,
                   isekai: false, golden: Math.random() < GOLDEN_RATE, size: rollSize(sg.min, sg.max, sg.name) };
        }
      }
    }
    let rid = regionId, isekai = false;
    if (Math.random() * 100 < ISEKAI_RATE) {
      const others = REGIONS.filter(r => r.id !== regionId);
      rid = others[Math.floor(Math.random() * others.length)].id;
      isekai = true;
    }
    const chum = state.gear.chum > 0;
    if (chum) state.gear.chum -= 1;
    const tier = rollTier(chum);
    const pool = TIER_OF_INDEX.map((t, i) => t === tier ? i : -1).filter(i => i >= 0);
    const idx = pool[Math.floor(Math.random() * pool.length)];
    const [emoji, name, min, max, desc] = REGION_BY_ID[rid].fish[idx];
    return { rid, idx, tier, emoji, name, min, max, desc, isekai,
             golden: Math.random() < GOLDEN_RATE, size: rollSize(min, max, name) };
  }

  function rollSize(min, max, name) {
    if (name === '특이점 금붕어') return Math.round(Math.random() * 9990) / 10;
    // 정규분포(Box–Muller), 범위 안으로 자름
    const u = 1 - Math.random(), v = Math.random();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    const mid = (min + max) / 2, sd = (max - min) / 6;
    const s = Math.min(max, Math.max(min, mid + z * sd));
    return Math.round(s * 10) / 10;
  }

  function recordCatch(c) {
    const key = c.sig || `${c.rid}:${c.idx}`;
    const book = c.sig ? state.sigDex : state.dex;
    const prev = book[key];
    const isNew = !prev;
    const isRecord = !prev || c.size > prev.best;
    book[key] = {
      n: (prev?.n || 0) + 1,
      best: Math.max(prev?.best || 0, c.size),
      g: !!(prev?.g || c.golden),
    };
    state.counters.catches += 1;
    if (c.name !== '특이점 금붕어' && c.size >= c.min + (c.max - c.min) * 0.95) state.counters.trophy += 1;
    state.counters.sameStreak = state.lastCatch === key ? state.counters.sameStreak + 1 : 1;
    state.counters.sameStreakMax = Math.max(state.counters.sameStreakMax, state.counters.sameStreak);
    state.lastCatch = key;
    if (c.golden) state.counters.golden += 1;
    if (c.isekai) state.counters.isekai += 1;
    save();
    return { isNew, isRecord: isRecord && !isNew };
  }

  // ─────────────────────────────── 캐릭터 고유종 ───────────────────────────────
  // 키: 1단계는 캐릭터 id, 2·3단계는 '캐릭터 id#단계'. 다시 만들어 밀려난 것은 '…~시각'으로 보관.
  const sigId = (charId, st) => st === 1 ? charId : `${charId}#${st}`;
  const sigChar = id => id.split('~')[0].split('#')[0];
  const sigLabel = st => (st || 1) > 1 ? `고유종 ${st}단계` : '고유종';
  // 받침에 맞는 조사: josa('고유종', '이', '가') → '고유종이'
  const josa = (w, a, b) => { const c = String(w).slice(-1).charCodeAt(0) - 0xAC00; return w + (c >= 0 && c <= 11171 && c % 28 ? a : b); };
  const isArchived = id => id.includes('~');
  function nextStage(charId) {
    for (let st = 1; st <= 3; st++) if (!state.sigs[sigId(charId, st)]) return st;
    return null;
  }
  const sigBusy = new Set();
  // 던질 때마다 호출: 다음 단계 조건이 되면 만든다. 실패하면 5번 더 던진 뒤 다시 시도.
  async function maybeMakeSig(charId, force) {
    const st = nextStage(charId);
    if (!st || sigBusy.has(charId)) return;
    const n = state.charCasts[charId] || 0, after = SIG_STAGES[st - 1].after;
    if (!force && (n < after || (n - after) % 5 !== 0)) return;
    sigBusy.add(charId);
    try {
      const char = await Risuai.getCharacter();
      if (!char || (char.chaId || char.name) !== charId) return;
      const sg = await requestSig(char, st);
      if (!sg) return;
      state.sigs[sigId(charId, st)] = { ...sg, stage: st, charId, charName: char.name || '', region: state.regions[charId]?.r || 'city', at: Date.now() };
      save();
      if (visible) { sigToast(char.name, st); if (tab === 'dex') render(); }
    } catch (e) {
      console.log('[낚시터] 고유종 생성 실패: ' + (e?.message || e));
    } finally { sigBusy.delete(charId); }
  }

  // 다시 만들기권: 새로 만든 뒤에야 권을 쓴다. 예전 고유종은 낚은 기록과 함께 보관한다.
  async function rerollSig(id) {
    const old = state.sigs[id]; if (!old) return;
    const charId = old.charId || sigChar(id);
    if (state.gear.rerolls <= 0) return alert(`다시 만들기권이 없어요. 상점에서 조개 ${REROLL_COST}개로 살 수 있어요.`);
    if (spot.charId !== charId) return alert(`${old.charName}의 채팅방에서 열어야 다시 만들 수 있어요.`);
    if (!confirm(`'${old.name}'을(를) 새 고유종으로 바꿀까요? 다시 만들기권 1장을 써요. 지금까지 낚은 기록은 '이전 고유종'으로 남아요.`)) return;
    if (sigBusy.has(charId)) return;
    sigBusy.add(charId); render();
    try {
      const char = await Risuai.getCharacter();
      const sg = char && await requestSig(char, old.stage || 1, old.name);
      if (!sg) return alert('새 고유종을 만들지 못했어요. 다시 만들기권은 그대로 있어요.');
      const archKey = `${id}~${Date.now()}`, oldDex = state.sigDex['sig:' + id];
      if (oldDex) { state.sigs[archKey] = { ...old, archived: true }; state.sigDex['sig:' + archKey] = oldDex; delete state.sigDex['sig:' + id]; }
      state.tank.forEach(it => { if (it.k === 'sig:' + id) it.k = 'sig:' + archKey; });
      state.sigs[id] = { ...sg, stage: old.stage || 1, charId, charName: char.name || old.charName, region: state.regions[charId]?.r || old.region, at: Date.now() };
      state.gear.rerolls -= 1;
      save();
      if (visible) sigToast(char.name, old.stage || 1);
    } catch (e) {
      console.log('[낚시터] 고유종 다시 만들기 실패: ' + (e?.message || e));
      alert('새 고유종을 만들지 못했어요. 다시 만들기권은 그대로 있어요.');
    } finally { sigBusy.delete(charId); render(); }
  }

  async function requestSig(char, st, replacing) {
    const info = [char.name && `이름: ${char.name}`, char.desc && `설명: ${String(char.desc).slice(0, 1500)}`,
                  char.personality && `성격: ${String(char.personality).slice(0, 300)}`].filter(Boolean).join('\n');
    const charId = char.chaId || char.name;
    const prev = [1, 2].filter(x => x < st).map(x => state.sigs[sigId(charId, x)]?.name).filter(Boolean);
    const maxCm = SIG_STAGES[st - 1].maxCm;
    const ask = st === 1
      ? '이 캐릭터의 낚시터에서만 잡히는 전설 물고기 한 종'
      : st === 2
        ? `이 낚시터의 더 깊은 곳에 사는 상위종 한 종. 앞서 나온 고유종 「${prev[0] || '?'}」보다 크고 위엄 있지만 연결고리가 느껴지게`
        : `이 낚시터의 주인이라 불리는 마지막 물고기 한 종. 앞서 나온 ${prev.map(n => `「${n}」`).join(', ') || '고유종들'}의 이야기가 여기서 끝나는 느낌으로`;
    const messages = [
      { role: 'system', content: '너는 낚시 게임의 물고기 디자이너야. 요청한 JSON 한 개만 출력하고 다른 말은 하지 마.' },
      { role: 'user', content: `아래 캐릭터의 세계관과 성격을 담아 ${ask}을(를) 만들어줘.${replacing ? `\n이전에 만든 「${replacing}」과(와)는 이름도 느낌도 다르게 해줘.` : ''}
규칙:
- name: 한국어 12자 이내, 재치 있게. 캐릭터 이름을 그대로 넣지 말 것
- desc: 한국어 25자 이내 한 줄 설명. 담담하고 웃긴 톤
- emoji: 물고기나 바다 생물, 또는 세계관에 맞는 물건 이모지 1개
- min, max: 크기(cm) 정수, 0 < min < max <= ${maxCm}${st > 1 ? '. 앞 단계보다 크게' : ''}
- 성적이거나 폭력적인 묘사는 넣지 말 것
출력 형식: {"emoji":"🐟","name":"...","desc":"...","min":30,"max":80}

${info}` },
    ];
    for (const mode of ['otherAx', 'submodel']) {
      let res;
      try { res = await Risuai.runLLMModel({ mode, messages }); } catch (_) { continue; }
      const sg = parseSig(await llmText(res), maxCm);
      if (sg) return sg;
    }
    return null;
  }

  async function llmText(res) {
    if (!res) return '';
    if (typeof res === 'string') return res;
    let r = res.result ?? res.content ?? res;
    if (res.type === 'fail') return '';
    if (Array.isArray(r)) r = r.map(x => x?.[1] ?? x).join('');
    if (r && typeof r.getReader === 'function') { // 스트림이면 끝까지 읽기
      const reader = r.getReader(); let out = '';
      for (;;) { const { done, value } = await reader.read(); if (done) break; out = typeof value === 'string' ? out + value : (value?.[0] ?? value?.text ?? out); }
      return out;
    }
    return typeof r === 'string' ? r : '';
  }

  function parseSig(text, maxCm = 5000) {
    const m = String(text || '').match(/\{[\s\S]*?\}/);
    if (!m) return null;
    let o; try { o = JSON.parse(m[0]); } catch (_) { return null; }
    const name = String(o.name || '').trim().slice(0, 16), desc = String(o.desc || '').trim().slice(0, 40);
    let min = Math.round(Number(o.min)), max = Math.round(Number(o.max));
    if (!name || !desc || !(min > 0) || !(max > min)) return null;
    max = Math.min(max, maxCm); min = Math.min(min, max - 1);
    const emoji = (String(o.emoji || '').match(/\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*/u) || ['🐟'])[0];
    return { emoji, name, desc, min, max };
  }

  // ─────────────────────────────── 소리·진동 ───────────────────────────────
  let audioCtx = null;
  function beep(freqs, dur = 0.12, type = 'sine') {
    if (!state.settings.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      freqs.forEach((f, i) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = type; o.frequency.value = f;
        const t = audioCtx.currentTime + i * dur;
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g).connect(audioCtx.destination);
        o.start(t); o.stop(t + dur);
      });
    } catch (_) {}
  }
  const sfx = {
    cast: () => beep([300, 200], 0.08, 'triangle'),
    bite: () => beep([880, 1320], 0.07, 'square'),
    win:  () => beep([523, 659, 784, 1047], 0.1),
    fail: () => beep([300, 220, 160], 0.12, 'sawtooth'),
  };
  function buzz(p) { if (state.settings.vibrate) try { navigator.vibrate?.(p); } catch (_) {} }

  // ─────────────────────────────── 물고기 그림 ───────────────────────────────
  // 이미지가 준비되면 image_base 폴더에 '<지역>_<번호 두 자리>.png'로 올리면 된다 (예: fantasy_01.png).
  // 불러오지 못한 그림은 자동으로 이모지로 돌아간다.
  const DEFAULT_ART_BASE = 'https://raw.githubusercontent.com/bampibubu-blip/risu-fishing/main/fish';
  let ART_BASE = DEFAULT_ART_BASE;
  async function loadArtBase() {
    let v = '';
    try { v = String((await Risuai.getArgument('image_base')) || '').trim().replace(/\/+$/, ''); } catch (_) {}
    ART_BASE = !v ? DEFAULT_ART_BASE : /^(none|off|emoji|0)$/i.test(v) ? '' : v;
  }
  const artFile = key => {
    if (!key || key.startsWith('sig:')) return null; // 고유종은 이미지가 없다
    const [rid, idx] = key.split(':');
    return `${rid}_${String(+idx + 1).padStart(2, '0')}.png`;
  };
  // 그림 주소: 고유종은 유저가 올린 그림(data URL), 일반 어종은 image_base 폴더
  function artSrc(key) {
    if (key && key.startsWith('sig:')) {
      const sg = state.sigs[key.slice(4)];
      return sg?.img ? { src: sg.img, flip: !!sg.flip } : null;
    }
    const file = ART_BASE && artFile(key);
    return file ? { src: ART_BASE + '/' + file, flip: false } : null;
  }
  function art(key, emoji) {
    const a = artSrc(key);
    return a
      ? `<img class="art${a.flip ? ' flip' : ''}" src="${esc(a.src)}" alt="" data-emo="${esc(emoji)}" draggable="false">`
      : `<span class="emo">${emoji}</span>`;
  }

  // 고유종 그림 올리기: 정사각형 192px 안에 맞춰 줄이고 투명 배경 유지
  async function imageToDataUrl(file) {
    const url = URL.createObjectURL(file);
    try {
      const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const S = 192, k = Math.min(S / im.width, S / im.height, 1);
      const w = Math.max(1, Math.round(im.width * k)), h = Math.max(1, Math.round(im.height * k));
      const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
      cv.getContext('2d').drawImage(im, (S - w) / 2, (S - h) / 2, w, h);
      const webp = cv.toDataURL('image/webp', 0.85);
      return webp.startsWith('data:image/webp') ? webp : cv.toDataURL('image/png');
    } finally { URL.revokeObjectURL(url); }
  }
  // 이미지 로딩 실패 → 이모지로 교체
  document.addEventListener('error', e => {
    const img = e.target;
    if (img && img.tagName === 'IMG' && img.classList.contains('art')) {
      const sp = document.createElement('span'); sp.className = 'emo'; sp.textContent = img.dataset.emo || '🐟'; img.replaceWith(sp);
    }
  }, true);
  const keyOfIdx = (rid, i) => `${rid}:${i}`;

  // ─────────────────────────────── UI ───────────────────────────────
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const EMPTY_MSG = '미끼가 없어요. 채팅을 하거나 번역 같은 보조 기능을 쓰면 미끼가 생겨요.';
  function shade(hex) { // 물 아래쪽을 조금 더 진하게
    const n = parseInt(hex.slice(1), 16), f = .82;
    return '#' + [16, 8, 0].map(b => Math.round(((n >> b) & 255) * f).toString(16).padStart(2, '0')).join('');
  }
  const fmtSize = cm => cm >= 100 ? `${(cm / 100).toFixed(2)} m` : `${cm.toFixed(1)} cm`;

  document.head.innerHTML = `<meta charset="utf-8"><style>
    :root{
      --paper:#f8fafb; --card:#ffffff; --ink:#22313f; --muted:#6a7886; --line:#dfe5ea; --wash:#eef2f5;
      --float:#d9432f; --focus:#2f6fd0;
    }
    *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
    html,body{height:100%;background:rgba(34,49,63,.28);font-family:Pretendard,'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',system-ui,sans-serif;color:var(--ink);overflow:hidden;font-size:15px;line-height:1.5}
    button{font:inherit;color:inherit}
    :focus-visible{outline:2px solid var(--focus);outline-offset:2px}
    #app{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px}
    .panel{position:relative;width:100%;max-width:420px;height:100%;max-height:720px;background:var(--paper);border-radius:14px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px rgba(34,49,63,.22)}
    header{display:flex;align-items:baseline;gap:12px;padding:16px 16px 10px}
    header .title{font-size:17px;font-weight:700;flex:1;letter-spacing:-.01em}
    .bait{font-size:14px;color:var(--muted);font-variant-numeric:tabular-nums}
    .bait b{color:var(--ink);font-weight:700}
    .x{background:none;border:none;color:var(--muted);font-size:20px;line-height:1;cursor:pointer;padding:4px;border-radius:6px}
    nav{display:flex;gap:20px;padding:0 16px;border-bottom:1px solid var(--line)}
    nav button{background:none;border:none;color:var(--muted);padding:8px 0 10px;font-size:15px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
    nav button.on{color:var(--ink);font-weight:600;border-bottom-color:var(--ink)}
    main{flex:1;overflow:auto;position:relative}
    .notice{margin:12px 16px 0;padding:10px 12px;border-radius:8px;background:#fff4e0;color:#7a4a00;font-size:13px}
    .spot{padding:14px 16px 0;font-size:14px;color:var(--muted)}
    .spot b{color:var(--ink);font-weight:600}
    .spot .new{color:var(--float)}
    .pond{position:relative;margin:10px 16px 12px;height:300px;border-radius:10px;overflow:hidden;cursor:pointer;user-select:none;touch-action:manipulation}
    .pond .ripples{position:absolute;left:0;right:0;top:30%;bottom:0;background:repeating-linear-gradient(180deg,rgba(255,255,255,.18) 0 1px,transparent 1px 18px)}
    .pond .horizon{position:absolute;left:0;right:0;top:30%;height:1px;background:rgba(255,255,255,.7)}
    .bobber{position:absolute;left:50%;top:58%;width:16px;height:24px;margin:-12px 0 0 -8px;border-radius:50% 50% 45% 45%;background:linear-gradient(var(--float) 0 48%,#fff 48%);box-shadow:0 1px 0 rgba(34,49,63,.25);display:none}
    .bobber.idle,.bobber.fake,.bobber.bite{display:block}
    .bobber.idle{animation:bob 2.4s ease-in-out infinite}
    .bobber.fake{animation:twitch .35s ease-in-out}
    .bobber.bite{animation:dip .28s ease-in-out infinite}
    .ring{position:absolute;left:50%;top:58%;width:60px;height:18px;margin:-2px 0 0 -30px;border:1.5px solid rgba(255,255,255,.85);border-radius:50%;opacity:0}
    .ring.on{animation:ring .7s ease-out infinite}
    @keyframes bob{50%{transform:translateY(3px)}}
    @keyframes twitch{30%{transform:translate(-2px,3px)}70%{transform:translate(2px,2px)}}
    @keyframes dip{50%{transform:translateY(12px)}}
    @keyframes ring{from{transform:scale(.4);opacity:1}to{transform:scale(1.6);opacity:0}}
    .msg{position:absolute;left:12px;right:12px;bottom:12px;text-align:center;font-size:14px;color:var(--ink);background:rgba(255,255,255,.82);border-radius:8px;padding:8px 10px}
    .msg:empty{display:none}
    .act{display:block;width:calc(100% - 32px);margin:0 16px 16px;padding:14px;border:none;border-radius:10px;font-size:16px;font-weight:700;color:#fff;background:var(--ink);cursor:pointer;touch-action:manipulation}
    .act.off{background:var(--wash);color:var(--muted);cursor:default}
    .act.reel{background:var(--float)}
    .act.holding{background:#a8321f}
    header .title small{display:block;font-size:12px;font-weight:500;color:var(--muted);margin-top:1px}
    .reelbox{position:absolute;left:12px;right:12px;top:12px;background:rgba(255,255,255,.9);border-radius:8px;padding:10px 12px;display:none}
    .reelbox.on{display:block}
    .reelbox .lbl{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:4px}
    .track{position:relative;height:14px;background:var(--wash);border-radius:3px;overflow:hidden}
    .track .zone{position:absolute;top:0;bottom:0;background:#cfe8d6}
    .track .needle{position:absolute;top:-2px;bottom:-2px;width:3px;margin-left:-1px;background:var(--ink);border-radius:1px}
    .track.danger .needle{background:var(--float)}
    .prog{height:6px;background:var(--wash);border-radius:3px;margin-top:8px;overflow:hidden}
    .prog i{display:block;height:100%;width:0;background:var(--ink)}
    .toasts{position:absolute;left:16px;right:16px;bottom:84px;display:flex;flex-direction:column;gap:6px;pointer-events:none;z-index:5}
    .toast{background:var(--ink);color:#fff;border-radius:8px;padding:10px 12px;font-size:14px;box-shadow:0 6px 18px rgba(34,49,63,.25);animation:lift .2s ease-out}
    .toast small{display:block;color:#c5ced8;font-size:12px}
    .achs{padding:4px 16px 16px}
    .ach{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--line)}
    .ach .mark{flex:none;width:28px;height:28px;border-radius:50%;background:var(--wash);color:#b7c0c9;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700}
    .ach.got .mark{background:var(--ink);color:#fff}
    .ach .body{flex:1;min-width:0}
    .ach .nm{font-size:15px;font-weight:600}
    .ach:not(.got) .nm{color:var(--muted)}
    .ach .ds{font-size:13px;color:var(--muted)}
    .ach .eq{flex:none;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:5px 10px;font-size:13px;cursor:pointer}
    .ach .eq.on{background:var(--ink);border-color:var(--ink);color:#fff}
    .act.hit{background:var(--float)}
    .card{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(248,250,251,.35)}
    .card .inner{width:100%;background:var(--card);border-radius:10px;padding:20px 18px 16px;box-shadow:0 6px 24px rgba(34,49,63,.18);animation:lift .2s ease-out}
    @keyframes lift{from{transform:translateY(8px);opacity:0}}
    .card .top{display:flex;align-items:center;gap:14px}
    .card .em{font-size:52px;line-height:1}
    .card .em.gold{filter:sepia(1) saturate(3) hue-rotate(-12deg) brightness(1.05)}
    .card .nm{font-size:19px;font-weight:700;line-height:1.3}
    .card .tier{font-size:13px;font-weight:600;color:var(--c)}
    .card .sz{font-size:28px;font-weight:700;margin-top:14px;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
    .card .ds{color:var(--muted);font-size:14px}
    .tags{margin-top:12px;display:flex;gap:6px;flex-wrap:wrap}
    .tag{font-size:12px;padding:3px 8px;border-radius:4px;background:var(--wash);color:var(--ink)}
    .tag.new{background:#fde7e3;color:#a12b1b}.tag.gold{background:#fbf0d2;color:#7a5600}
    .card .hint{margin-top:14px;font-size:12px;color:var(--muted)}
    .summary{padding:16px 16px 4px;display:flex;align-items:baseline;gap:8px}
    .summary .n{font-size:28px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
    .summary .of{color:var(--muted);font-size:14px}
    .regions{display:flex;gap:16px;overflow-x:auto;padding:8px 16px 0;scrollbar-width:none;border-bottom:1px solid var(--line)}
    .regions button{flex:none;background:none;border:none;padding:6px 0 9px;font-size:14px;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap}
    .regions button.on{color:var(--ink);font-weight:600;border-bottom-color:var(--ink)}
    .regions small{font-size:12px;margin-left:4px;font-variant-numeric:tabular-nums}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px 16px}
    .cell{background:var(--card);border:1px solid var(--line);border-top:3px solid var(--c);border-radius:6px;padding:10px 6px 8px;text-align:center;min-height:100px;cursor:pointer}
    .cell.un{background:var(--wash);border-color:transparent;border-top-color:var(--c)}
    .cell.sel{border-color:var(--ink);border-top-color:var(--c)}
    .cell .em{font-size:28px;line-height:1.2}
    .cell.un .em{color:#b7c0c9;font-size:22px;line-height:34px;font-weight:700}
    .cell .nm{font-size:12px;margin-top:4px;line-height:1.3;word-break:keep-all}
    .cell .meta{font-size:11px;color:var(--muted);margin-top:2px;font-variant-numeric:tabular-nums}
    .detail{margin:0 16px 16px;padding:12px 14px;background:var(--card);border:1px solid var(--line);border-radius:8px;font-size:14px}
    .detail .sub{color:var(--muted);font-size:13px;margin-top:4px}
    .sec{padding:16px;border-bottom:1px solid var(--line)}
    .sec h3{font-size:15px;font-weight:700;margin-bottom:6px}
    .sec p{font-size:13px;color:var(--muted);margin-bottom:6px}
    .row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:14px}
    .row span:last-child{font-variant-numeric:tabular-nums}
    .row.total{border-top:1px solid var(--line);margin-top:4px;padding-top:8px;font-weight:600}
    .tog{width:42px;height:24px;border-radius:12px;background:#cdd5dc;border:none;position:relative;cursor:pointer;flex:none}
    .tog::after{content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .15s}
    .tog.on{background:var(--ink)}.tog.on::after{left:21px}
    .btn{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:9px 14px;font-size:14px;cursor:pointer;margin:4px 6px 0 0}
    .link{background:none;border:none;color:var(--muted);text-decoration:underline;text-underline-offset:2px;font-size:13px;cursor:pointer;margin-left:4px}
    .picker{display:flex;flex-wrap:wrap;gap:6px;padding:10px 16px 0}
    .picker button{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:6px 10px;font-size:13px;cursor:pointer}
    .picker button.on{border-color:var(--ink);font-weight:600}
    .pickhint{padding:8px 16px 0;font-size:12px;color:var(--muted)}
    header .link{margin-left:0;font-size:14px;text-decoration:none}
    header .link.on{color:var(--ink);font-weight:600}
    .cardacts{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:14px}
    .btn.pri{background:var(--ink);border-color:var(--ink);color:#fff}
    .btn.sm{padding:6px 10px;font-size:13px;margin:0;flex:none}
    .btn.dim{color:var(--muted)}
    .cardacts .btn{margin:0}
    .tanklist,.shop{padding:4px 16px 16px}
    .titem,.sitem{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}
    .titem .em{font-size:28px;width:36px;text-align:center;flex:none}
    .titem .em.gold{filter:sepia(1) saturate(3) hue-rotate(-12deg)}
    .titem .body,.sitem .body{flex:1;min-width:0}
    .titem .nm,.sitem .nm{font-size:15px;font-weight:600}
    .titem .ds,.sitem .ds{font-size:13px;color:var(--muted)}
    .shop h3,.subh{font-size:13px;color:var(--muted);font-weight:600;margin:16px 0 0}
    .subh{margin:20px 0 0}
    .owned{font-size:13px;color:var(--muted);flex:none}
    .shopnote{padding:0 16px;font-size:13px;color:var(--muted)}
    .empty{padding:24px 16px;color:var(--muted);font-size:14px}
    .em img.art,.fishy img.art,.titem img.art{width:1.15em;height:1.15em;object-fit:contain;vertical-align:middle;display:inline-block}
    img.art.flip{transform:scaleX(-1)}
    .sigchar{padding:4px 16px 8px}
    .sigchar h3{font-size:15px;margin:14px 0 2px;display:flex;align-items:baseline;gap:8px}
    .sigchar h3 small{font-size:12px;color:var(--muted);font-weight:500}
    .signext{font-size:13px;color:var(--muted);padding:10px 0;border-bottom:1px solid var(--line)}
    .sigold{font-size:12px;color:var(--muted);margin-top:12px}
    .sigacts{display:flex;gap:12px;margin-top:4px}
    .sigacts .link{margin:0;font-size:12px}
    .tankhead{display:flex;align-items:center;justify-content:space-between;padding:16px 16px 0}
    .seg{display:flex;background:var(--wash);border-radius:8px;padding:3px}
    .seg button{background:none;border:none;padding:5px 12px;border-radius:6px;font-size:13px;color:var(--muted);cursor:pointer}
    .seg button.on{background:var(--card);color:var(--ink);font-weight:600;box-shadow:0 1px 2px rgba(34,49,63,.12)}
    .aqua{position:relative;margin:12px 16px 0;height:320px;border-radius:6px;overflow:hidden;background:linear-gradient(#e4f3f7,#b7dbe6 70%,#a5cfdc);border:6px solid #d5dde3;border-top-width:10px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.6)}
    .aq-light{position:absolute;inset:0;background:repeating-linear-gradient(100deg,rgba(255,255,255,.18) 0 18px,transparent 18px 70px);mix-blend-mode:soft-light;pointer-events:none}
    .aq-sand{position:absolute;left:0;right:0;bottom:0;height:26px;background:linear-gradient(#e6dcc4,#d8cba9);border-top:1px solid rgba(255,255,255,.5)}
    .aq-weed{position:absolute;left:0;right:0;bottom:18px;width:100%;height:120px;fill:none;stroke:#6fa58a;stroke-width:5;stroke-linecap:round;opacity:.75;pointer-events:none}
    .aq-bub{position:absolute;bottom:26px;width:6px;height:6px;border-radius:50%;border:1.5px solid rgba(255,255,255,.85);animation:bub 4s linear infinite;pointer-events:none}
    .aq-bub.b2{animation-duration:5.5s;animation-delay:1.7s}
    @keyframes bub{from{transform:translateY(0);opacity:0}10%{opacity:1}to{transform:translateY(-290px);opacity:.2}}
    .fishy{position:absolute;left:0;top:0;background:none;border:none;padding:0;line-height:1;cursor:pointer;will-change:transform;touch-action:manipulation}
    .fishy .body{display:block;filter:drop-shadow(0 2px 1px rgba(34,49,63,.15))}
    .fishy.gold .body{filter:sepia(1) saturate(3) hue-rotate(-12deg) drop-shadow(0 0 4px rgba(255,214,90,.9))}
    .fishy.sel::after{content:'';position:absolute;left:50%;bottom:-9px;width:6px;height:6px;margin-left:-3px;border-radius:50%;background:var(--ink)}
    .aq-empty{position:absolute;left:16px;right:16px;top:42%;text-align:center;color:#4b6573;font-size:14px}
    .fishcard{display:flex;gap:12px;margin:10px 16px 0;padding:12px;background:var(--card);border:1px solid var(--line);border-radius:8px}
    .fishcard .em{font-size:40px;line-height:1;flex:none}
    .fishcard .em.gold{filter:sepia(1) saturate(3) hue-rotate(-12deg)}
    .fishcard .body{flex:1;min-width:0}
    .fishcard .nm{font-size:15px;font-weight:600}
    .fishcard .ds{font-size:13px;color:var(--muted)}
    .fishcard .acts{display:flex;align-items:center;gap:10px;margin-top:8px}
    @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  </style>`;
  document.body.innerHTML = `<div id="app"></div>`;
  const app = document.getElementById('app');

  let tab = 'fish';
  let dexRegion = null;
  let dexDetail = null;
  let spot = { regionId: 'dream', charName: null, isNew: false };
  let fishing = null; // 진행 중인 낚시 세션
  let picking = false; // 낚시터 직접 고르기 열림 여부

  function hudBait() { return `미끼 <b>${state.bait}</b>&ensp;조개 <b>${state.shells}</b>`; }
  function refreshHud() {
    const el = document.getElementById('bait');
    if (el) el.innerHTML = hudBait();
    const btn = document.getElementById('act');
    if (btn && !fishing && !btn.classList.contains('reel')) btn.classList.toggle('off', state.bait <= 0);
  }

  function render() {
    cancelAnimationFrame(aquaRaf);
    app.innerHTML = `<div class="panel">
      <header><span class="title">리스 낚시터${titleName(state.title) ? `<small>${esc(titleName(state.title))}</small>` : ''}</span><span class="bait" id="bait">${hudBait()}</span><button class="link ${tab === 'set' ? 'on' : ''}" id="toset">설정</button><button class="x" id="close" aria-label="닫기">✕</button></header>
      <nav>${[['fish','낚시'],['tank','수조'],['dex','도감'],['shop','상점'],['ach','업적']].map(([k,l]) => `<button data-tab="${k}" class="${tab===k?'on':''}">${l}</button>`).join('')}</nav>
      <main id="main"></main><div class="toasts" id="toasts"></div></div>`;
    document.getElementById('close').onclick = close;
    document.getElementById('toset').onclick = () => { if (fishing) cancelFishing(); resolvePending(); tab = 'set'; render(); };
    app.querySelectorAll('nav button').forEach(b => b.onclick = () => { if (fishing) cancelFishing(); resolvePending(); tab = b.dataset.tab; render(); });
    const main = document.getElementById('main');
    if (tab === 'fish') renderFish(main);
    else if (tab === 'dex') renderDex(main);
    else if (tab === 'ach') renderAch(main);
    else if (tab === 'tank') renderTank(main);
    else if (tab === 'shop') renderShop(main);
    else renderSettings(main);
    const onReg = main.querySelector('.regions button.on');
    if (onReg) onReg.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  // ── 낚시 화면
  function renderFish(main) {
    const r = REGION_BY_ID[spot.regionId];
    main.innerHTML = `
      ${hookState === 'off' ? `<div class="notice">권한이 없어서 미끼를 모으지 못하고 있어요. 플러그인을 다시 불러온 뒤 권한 요청을 허용해 주세요.</div>` : ''}
      <div class="spot">${spot.charName ? `${esc(spot.charName)}의 낚시터, ` : ''}<b>${r.name}</b>${spot.charId ? ' <button class="link" id="change">바꾸기</button>' : ''}${spot.isNew ? '<br><span class="new">처음 와 보는 낚시터예요</span>' : ''}</div>
      ${picking ? `<div class="pickhint">지역을 바꾸면 이동권 1장을 써요. 남은 이동권 ${state.gear.tickets}장</div><div class="picker">${REGIONS.map(x => `<button class="${x.id === r.id ? 'on' : ''}" data-r="${x.id}">${x.name}</button>`).join('')}</div>` : ''}
      <div class="pond" id="pond" style="background:linear-gradient(${r.water[0]} 0 30%,${r.water[1]} 30%,${shade(r.water[1])} 100%)">
        <div class="horizon"></div><div class="ripples"></div>
        <div class="ring" id="ring"></div>
        <div class="reelbox" id="reelbox"><div class="lbl"><span>줄 장력</span><span id="reeltip">초록 구간에 바늘을 두세요</span></div>
          <div class="track" id="track"><div class="zone" id="zone"></div><div class="needle" id="needle"></div></div>
          <div class="prog"><i id="prog"></i></div></div>
        <div class="bobber" id="bobber"></div>
        <div class="msg" id="msg">${state.bait > 0 ? '찌를 던지고, 찌가 크게 가라앉을 때 챔질하세요.' : EMPTY_MSG}</div>
      </div>
      <button class="act ${state.bait > 0 ? '' : 'off'}" id="act">던지기</button>`;
    spot.isNew = false;
    const ch = document.getElementById('change');
    if (ch) ch.onclick = () => { if (fishing) return; picking = !picking; render(); };
    main.querySelectorAll('.picker button').forEach(b => b.onclick = () => {
      if (b.dataset.r === spot.regionId) { picking = false; return render(); }
      if (state.gear.tickets <= 0) { alert(`지역 이동권이 없어요. 상점에서 조개 ${TICKET_COST}개로 살 수 있어요.`); return; }
      state.gear.tickets -= 1;
      state.regions[spot.charId] = { ...state.regions[spot.charId], r: b.dataset.r, manual: true };
      spot.regionId = b.dataset.r; picking = false; save(); render();
    });
    const act = document.getElementById('act'), pond = document.getElementById('pond');
    act.addEventListener('pointerdown', e => { e.preventDefault(); onAction(); });
    pond.addEventListener('pointerdown', e => { e.preventDefault(); if (fishing) onAction(); });
    for (const el of [act, pond]) for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, onRelease);
  }

  function setMsg(t) { const m = document.getElementById('msg'); if (m) m.textContent = t; }
  function setBobber(cls) { const b = document.getElementById('bobber'); if (b) b.className = 'bobber ' + cls; }
  function setBang(on) { const b = document.getElementById('ring'); if (b) b.className = 'ring' + (on ? ' on' : ''); }
  function setAct(label, cls = '', disabled = false) {
    const a = document.getElementById('act');
    if (!a) return;
    a.textContent = label; a.className = 'act ' + cls + (disabled ? ' off' : ''); a.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  }

  function onAction() {
    if (!fishing) return startCast();
    if (fishing.phase === 'wait') return failEarly();
    if (fishing.phase === 'bite') return hook();
    if (fishing.phase === 'reel') { fishing.reel.holding = true; setAct('감는 중', 'reel holding'); }
  }
  function onRelease() {
    if (fishing?.phase === 'reel' && fishing.reel.holding) { fishing.reel.holding = false; setAct('누르고 있으면 감겨요', 'reel'); }
  }

  function startCast() {
    if (state.bait <= 0) { state.counters.emptyTaps += 1; save(); checkAch(); return; }
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) state.counters.midnight += 1;
    state.bait -= 1;
    state.counters.casts += 1;
    if (spot.charId) {
      state.charCasts[spot.charId] = (state.charCasts[spot.charId] || 0) + 1;
      maybeMakeSig(spot.charId);
    }
    save(); refreshHud();
    sfx.cast();
    const waitMs = 2000 + Math.random() * 6000;
    fishing = { phase: 'wait', timers: [], fakeNow: false, catch: rollCatch(spot.regionId) };
    setBobber('idle'); setBang(false);
    setMsg('찌를 지켜보는 중. 살짝 흔들리는 건 가짜 입질이에요.');
    setAct('기다리는 중', '', false);
    // 가짜 입질 0~2회
    const fakes = Math.random() < 0.35 ? (Math.random() < 0.3 ? 2 : 1) : 0;
    for (let i = 0; i < fakes; i++) {
      const t = 600 + Math.random() * (waitMs - 1200);
      fishing.timers.push(setTimeout(() => {
        if (!fishing || fishing.phase !== 'wait') return;
        fishing.fakeNow = true; setBobber('fake');
        fishing.timers.push(setTimeout(() => { if (fishing) { fishing.fakeNow = false; if (fishing.phase === 'wait') setBobber('idle'); } }, 400));
      }, t));
    }
    fishing.timers.push(setTimeout(bite, waitMs));
  }

  function bite() {
    if (!fishing) return;
    fishing.phase = 'bite';
    fishing.biteAt = performance.now();
    setBobber('bite'); setBang(true);
    setAct('챔질', 'hit');
    setMsg('입질이 왔어요!');
    sfx.bite(); buzz(60);
    const win = TIERS[fishing.catch.tier].window * ROD[state.gear.rod].win;
    fishing.timers.push(setTimeout(() => { if (fishing?.phase === 'bite') endFail('늦었어요. 물고기가 미끼만 먹고 도망갔어요.', 'miss'); }, win));
  }

  function failEarly() {
    const fake = fishing.fakeNow;
    endFail(fake ? '가짜 입질이었어요. 물고기가 놀라서 도망갔어요.' : '너무 일찍 챘어요. 물고기가 도망갔어요.', fake ? 'fake' : 'early');
  }

  function endFail(text, counter) {
    state.counters[counter] += 1; save();
    clearFishing();
    setBobber(''); setBang(false);
    setMsg(text); sfx.fail(); buzz([30, 40, 30]);
    setAct('다시 던지기', '', state.bait <= 0);
    checkAch();
  }

  function hook() {
    const c = fishing.catch;
    if (c.tier >= 2) return startReel(c);
    clearFishing();
    setBobber(''); setBang(false);
    landFish(c);
  }

  function landFish(c) {
    resolvePending();
    const { isNew, isRecord } = recordCatch(c);
    if (c.tier === 3) state.counters.legendFailStreak = 0;
    sfx.win(); buzz([40, 30, 80]);
    showCard(c, isNew, isRecord);
    checkAch();
  }

  // ── 릴 감기: 누르고 있으면 장력이 오르고, 떼면 내려간다. 물고기가 가끔 확 당긴다.
  function startReel(c) {
    fishing.timers.forEach(clearTimeout); fishing.timers = [];
    const base = REEL[c.tier], wz = ROD[state.gear.rod].zone;
    const cfg = { ...base, zone: [base.zone[0] - wz, base.zone[1] + wz] };
    fishing.phase = 'reel';
    fishing.reel = { t: 50, prog: 0, slack: 0, holding: false, nextYank: rand(...cfg.every), last: performance.now(), cfg };
    setBang(false); setBobber('bite');
    const box = document.getElementById('reelbox'); if (box) box.classList.add('on');
    const zone = document.getElementById('zone');
    if (zone) { zone.style.left = cfg.zone[0] + '%'; zone.style.width = (cfg.zone[1] - cfg.zone[0]) + '%'; }
    setMsg(c.tier === 3 ? '엄청난 무게예요! 줄이 끊어지지 않게 조심하세요.' : '묵직해요! 감아서 끌어올리세요.');
    setAct('누르고 있으면 감겨요', 'reel');
    fishing.raf = requestAnimationFrame(reelTick);
  }
  const rand = (a, b) => a + Math.random() * (b - a);

  function reelTick(now) {
    if (!fishing || fishing.phase !== 'reel') return;
    const r = fishing.reel, cfg = r.cfg;
    const dt = Math.min(0.05, (now - r.last) / 1000); r.last = now;
    r.t += (r.holding ? 55 : -40) * dt;
    r.nextYank -= dt;
    if (r.nextYank <= 0) { r.t += rand(...cfg.yank); r.nextYank = rand(...cfg.every); buzz(20); }
    r.t = Math.max(0, r.t);
    const inZone = r.t >= cfg.zone[0] && r.t <= cfg.zone[1];
    if (inZone) r.prog += dt;
    // 줄이 계속 느슨하면(구간 한참 아래) 물고기가 빠져나간다
    r.slack = r.t < cfg.zone[0] - 10 ? r.slack + dt : 0;
    const needle = document.getElementById('needle'), prog = document.getElementById('prog'), track = document.getElementById('track'), tip = document.getElementById('reeltip');
    if (needle) needle.style.left = Math.min(100, r.t) + '%';
    if (prog) prog.style.width = Math.min(100, r.prog / cfg.need * 100) + '%';
    if (track) track.classList.toggle('danger', !inZone);
    if (tip) tip.textContent = r.t > cfg.zone[1] ? '너무 세게 당기고 있어요' : r.t < cfg.zone[0] ? '줄이 느슨해요' : '좋아요, 그대로';
    if (r.t >= 100) return reelFail('줄이 끊어졌어요. 너무 세게 당겼어요.');
    if (r.slack >= 1.5) return reelFail('줄이 느슨해져서 물고기가 빠져나갔어요.');
    if (r.prog >= cfg.need) {
      const c = fishing.catch;
      endReelUi(); clearFishing(); setBobber('');
      return landFish(c);
    }
    fishing.raf = requestAnimationFrame(reelTick);
  }

  function endReelUi() {
    const box = document.getElementById('reelbox'); if (box) box.classList.remove('on');
  }

  function reelFail(text) {
    const tier = fishing.catch.tier;
    endReelUi();
    state.counters.reelFail += 1;
    if (tier === 3) {
      state.counters.legendFailStreak += 1;
      state.counters.legendFailStreakMax = Math.max(state.counters.legendFailStreakMax, state.counters.legendFailStreak);
    }
    clearFishing();
    setBobber(''); setBang(false);
    setMsg(text); sfx.fail(); buzz([30, 40, 30]);
    setAct('다시 던지기', '', state.bait <= 0);
    save(); checkAch();
  }

  function clearFishing() {
    if (fishing) { fishing.timers.forEach(clearTimeout); if (fishing.raf) cancelAnimationFrame(fishing.raf); }
    fishing = null;
  }
  function cancelFishing() { clearFishing(); }

  function showCard(c, isNew, isRecord) {
    const t = TIERS[c.tier];
    const item = { k: c.sig || `${c.rid}:${c.idx}`, s: c.size, g: c.golden, i: c.isekai, t: Date.now(), c: spot.charName || '' };
    const pond = document.getElementById('pond');
    if (!pond) return;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="inner" style="--c:${c.golden ? '#a87800' : t.color}">
      <div class="top"><div class="em ${c.golden ? 'gold' : ''}">${art(c.sig || keyOfIdx(c.rid, c.idx), c.emoji)}</div>
        <div><div class="nm">${c.golden ? '황금 ' : ''}${esc(c.name)}</div><div class="tier">${t.label}</div></div></div>
      <div class="sz">${fmtSize(c.size)}</div>
      <div class="ds">${esc(c.desc)}</div>
      ${(isNew || isRecord || c.golden || c.isekai || c.sig) ? `<div class="tags">
        ${isNew ? '<span class="tag new">처음 낚음</span>' : ''}
        ${isRecord ? '<span class="tag">최고 기록 갱신</span>' : ''}
        ${c.golden ? '<span class="tag gold">황금 개체</span>' : ''}
        ${c.isekai ? `<span class="tag">다른 세계에서 옴: ${REGION_BY_ID[c.rid].name}</span>` : ''}
        ${c.sig ? `<span class="tag gold">${esc(spot.charName || '')}의 ${sigLabel(c.stage)}</span>` : ''}
      </div>` : ''}
      <div class="cardacts">
        <button class="btn pri" data-a="keep">${state.tank.length >= state.tankCap ? '수조가 꽉 찼어요' : '수조에 넣기'}</button>
        <button class="btn" data-a="sell">팔기, 조개 ${priceOf(item)}개</button>
        <button class="link" data-a="img">어탁 이미지 저장</button>
      </div></div>`;
    pond.appendChild(card);
    pending = item;
    setMsg('');
    setAct(state.bait > 0 ? '다시 던지기' : '미끼 없음', '', state.bait <= 0);
    card.addEventListener('pointerdown', e => e.stopPropagation());
    card.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      const a = b.dataset.a;
      if (a === 'img') return saveGyotaku(item);
      if (a === 'keep' && state.tank.length >= state.tankCap) return alert('수조가 꽉 찼어요. 팔거나 상점에서 수조를 넓혀 주세요.');
      if (a === 'keep') state.tank.push(item); else sellItem(item);
      pending = null; save(); card.remove();
      setMsg(state.bait > 0 ? '' : EMPTY_MSG);
    });
  }

  // 결과 카드에서 아무것도 고르지 않고 떠나면: 자리가 있으면 수조에, 없으면 판다
  let pending = null;
  function resolvePending() {
    if (!pending) return;
    if (state.tank.length < state.tankCap) state.tank.push(pending); else sellItem(pending);
    pending = null; save();
  }
  function sellItem(it) {
    addShells(priceOf(it)); state.counters.sold += 1; save(); checkAch();
  }

  // ── 도감 화면
  function regionCount(r) {
    return r.fish.reduce((a, _, i) => a + (state.dex[`${r.id}:${i}`] ? 1 : 0), 0);
  }
  function renderSigs(main, total) {
    const live = Object.keys(state.sigs).filter(id => !isArchived(id));
    const got = live.filter(id => state.sigDex['sig:' + id]).length;
    const chars = [...new Set([...live.map(id => state.sigs[id].charId || sigChar(id)), ...(spot.charId ? [spot.charId] : [])])];
    const sigRow = id => {
      const sg = state.sigs[id], d = state.sigDex['sig:' + id];
      if (!d) return `<div class="titem"><div class="em" style="color:#b7c0c9;font-weight:700;font-size:20px">?</div><div class="body"><div class="nm" style="color:var(--muted)">${sigLabel(sg.stage)}</div>
        <div class="ds">아직 못 낚았어요. 던질 때마다 ${Math.round(SIG_STAGES[(sg.stage || 1) - 1].rate * 1000) / 10}% 확률로 걸려요.</div></div></div>`;
      return `<div class="titem"><div class="em ${d.g ? 'gold' : ''}">${art('sig:' + id, sg.emoji)}</div><div class="body"><div class="nm">${esc(sg.name)} <span style="color:${TIERS[3].color};font-size:12px;font-weight:600">${sigLabel(sg.stage)}</span></div>
        <div class="ds">${esc(sg.desc)}<br>최고 기록 ${fmtSize(d.best)}, ${d.n}마리</div>
        ${isArchived(id) ? '' : `<div class="sigacts"><button class="link" data-sigimg="${esc(id)}">${sg.img ? '그림 바꾸기' : '그림 넣기'}</button>${sg.img ? `<button class="link" data-sigflip="${esc(id)}">좌우 뒤집기</button><button class="link" data-sigclear="${esc(id)}">이모지로</button>` : ''}<button class="link" data-reroll="${esc(id)}">다시 만들기</button></div>`}</div></div>`;
    };
    const charBlock = cid => {
      const name = state.sigs[cid]?.charName || state.regions[cid]?.name || (cid === spot.charId ? spot.charName : '') || '이름 없음';
      const n = state.charCasts[cid] || 0, nx = nextStage(cid);
      const archived = Object.keys(state.sigs).filter(id => isArchived(id) && sigChar(id) === cid);
      return `<div class="sigchar"><h3>${esc(name)}<small>${n}번 낚시</small></h3>
        ${[1, 2, 3].map(st => state.sigs[sigId(cid, st)] ? sigRow(sigId(cid, st)) : '').join('')}
        ${nx ? `<div class="signext">${sigBusy.has(cid) ? `${josa(sigLabel(nx), '을', '를')} 만드는 중이에요.` : `${sigLabel(nx)}: ${Math.max(0, SIG_STAGES[nx - 1].after - n)}번 더 낚시하면 나타나요.`}</div>` : ''}
        ${archived.length ? `<div class="sigold">이전 고유종</div>${archived.map(sigRow).join('')}` : ''}</div>`;
    };
    main.innerHTML = `
      <div class="summary"><span class="n">${total}</span><span class="of">/ ${TOTAL_SPECIES}종 발견</span></div>
      <div class="regions">${REGIONS.map(x => `<button data-r="${x.id}">${x.name}<small>${regionCount(x)}/15</small></button>`).join('')}<button class="on" data-r="sig">고유종<small>${got}/${live.length}</small></button></div>
      <p class="shopnote" style="padding-top:12px">한 캐릭터와 ${SIG_STAGES.map(x => x.after).join(', ')}번 낚시할 때마다 그 캐릭터만의 고유종이 한 단계씩 생겨요. 낚은 고유종에는 그림을 넣을 수 있고, 다시 만들기권으로 새로 만들 수도 있어요. 다시 만들기권 ${state.gear.rerolls}장</p>
      ${chars.length ? chars.map(charBlock).join('') : `<div class="empty">아직 고유종이 없어요.</div>`}`;
    main.querySelectorAll('[data-reroll]').forEach(b => b.onclick = () => rerollSig(b.dataset.reroll));
    main.querySelectorAll('.regions button').forEach(b => b.onclick = () => { dexRegion = b.dataset.r; dexDetail = null; render(); });
    const picker = document.createElement('input');
    picker.type = 'file'; picker.accept = 'image/png,image/jpeg,image/webp,image/gif'; picker.style.display = 'none';
    main.appendChild(picker);
    let target = null;
    main.querySelectorAll('[data-sigimg]').forEach(b => b.onclick = () => { target = b.dataset.sigimg; picker.value = ''; picker.click(); });
    picker.onchange = async () => {
      const f = picker.files?.[0]; if (!f || !target || !state.sigs[target]) return;
      if (!f.type.startsWith('image/')) return alert('이미지 파일만 넣을 수 있어요.');
      if (f.size > 8 * 1024 * 1024) return alert('8MB보다 작은 이미지를 골라 주세요.');
      try { state.sigs[target].img = await imageToDataUrl(f); state.sigs[target].flip = false; save(); render(); }
      catch (_) { alert('이미지를 읽지 못했어요. 다른 파일로 다시 시도해 주세요.'); }
    };
    main.querySelectorAll('[data-sigflip]').forEach(b => b.onclick = () => { const sg = state.sigs[b.dataset.sigflip]; sg.flip = !sg.flip; save(); render(); });
    main.querySelectorAll('[data-sigclear]').forEach(b => b.onclick = () => {
      if (!confirm('올린 그림을 지우고 이모지로 되돌릴까요?')) return;
      const sg = state.sigs[b.dataset.sigclear]; delete sg.img; delete sg.flip; save(); render();
    });
  }

  function renderDex(main) {
    dexRegion = dexRegion || spot.regionId;
    if (dexRegion === 'sig') return renderSigs(main, REGIONS.reduce((a, r) => a + regionCount(r), 0));
    const total = REGIONS.reduce((a, r) => a + regionCount(r), 0);
    const r = REGION_BY_ID[dexRegion];
    main.innerHTML = `
      <div class="summary"><span class="n">${total}</span><span class="of">/ ${TOTAL_SPECIES}종 발견</span></div>
      <div class="regions">${REGIONS.map(x => `<button class="${x.id === dexRegion ? 'on' : ''}" data-r="${x.id}">${x.name}<small>${regionCount(x)}/15</small></button>`).join('')}<button data-r="sig">고유종<small>${Object.keys(state.sigDex).length}/${Object.keys(state.sigs).length}</small></button></div>
      <div class="grid">${r.fish.map(([em, nm, min, max], i) => {
        const d = state.dex[`${r.id}:${i}`];
        const t = TIERS[TIER_OF_INDEX[i]];
        const sel = dexDetail === i ? ' sel' : '';
        return d
          ? `<button class="cell${sel}" style="--c:${t.color}" data-i="${i}"><div class="em ${d.g ? 'gold' : ''}">${art(keyOfIdx(r.id, i), em)}</div><div class="nm">${esc(nm)}</div><div class="meta">${fmtSize(d.best)} · ${d.n}마리</div></button>`
          : `<button class="cell un${sel}" style="--c:${t.color}" data-i="${i}"><div class="em">?</div><div class="nm">아직 못 낚음</div><div class="meta">${t.label}</div></button>`;
      }).join('')}</div>
      ${dexDetail !== null ? detailHtml(r, dexDetail) : ''}`;
    main.querySelectorAll('.regions button').forEach(b => b.onclick = () => { dexRegion = b.dataset.r; dexDetail = null; render(); });
    main.querySelectorAll('.cell').forEach(c => c.onclick = () => { const i = +c.dataset.i; dexDetail = dexDetail === i ? null : i; render(); });
  }
  function detailHtml(r, i) {
    const d = state.dex[`${r.id}:${i}`];
    const [em, nm, min, max, desc] = r.fish[i];
    const t = TIERS[TIER_OF_INDEX[i]];
    if (!d) return `<div class="detail">아직 낚지 못한 ${t.label} 등급 어종이에요.<div class="sub">${REGION_BY_ID[r.id].name}과 연결된 캐릭터와 낚시하면 만날 수 있어요.</div></div>`;
    return `<div class="detail"><b>${esc(nm)}</b> <span style="color:${t.color};font-weight:600">${t.label}</span><br>${esc(desc)}
      <div class="sub">최고 기록 ${fmtSize(d.best)} (크기 범위 ${fmtSize(min)}~${fmtSize(max)}), ${d.n}마리 낚음${d.g ? ', 황금 개체 보유' : ''}</div></div>`;
  }

  // ── 수조 화면
  function itemInfo(it) {
    if (it.k.startsWith('sig:')) {
      const sg = state.sigs[it.k.slice(4)]; if (!sg) return null;
      return { r: REGION_BY_ID[sg.region] || REGION_BY_ID.city, f: [sg.emoji, sg.name, sg.min, sg.max, sg.desc], tier: 3, sig: true, stage: sg.stage || 1 };
    }
    const [rid, idx] = it.k.split(':'); const r = REGION_BY_ID[rid]; const f = r?.fish[+idx];
    return f ? { r, f, tier: TIER_OF_INDEX[+idx] } : null;
  }
  // 물고기마다 움직임 종류: 헤엄 / 바닥 기어다님 / 수면에 뜸 / 바닥에 가라앉음(잡동사니)
  const SWIM = new Set([...'🐟🐠🐡🦈🐋🐬🐙🦑🦐🐍🐉🐲🐊🐢🦭🪼'].filter(c => c.trim()));
  const CRAWL = new Set(['🦀', '🐌', '🦞', '🐸']);
  const FLOAT = new Set(['🦆', '🫧', '🍄']);
  function motionOf(emoji) {
    const e = [...emoji][0];
    if (CRAWL.has(e)) return 'crawl';
    if (FLOAT.has(e)) return 'float';
    if (SWIM.has(e) || emoji === '🐉' || emoji === '🐲') return 'swim';
    return 'sink';
  }
  let tankView = 'aqua', tankSel = null, aquaRaf = 0, aquaFish = [];
  const reduceMotion = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } })();

  function renderTank(main) {
    const items = state.tank.map((it, n) => ({ it, n, info: itemInfo(it) })).filter(x => x.info);
    const commons = state.tank.filter(it => itemInfo(it)?.tier === 0 && !it.g);
    const sel = tankSel !== null ? items.find(x => x.n === tankSel) : null;
    main.innerHTML = `
      <div class="tankhead"><div class="summary" style="padding:0"><span class="n">${state.tank.length}</span><span class="of">/ ${state.tankCap}칸</span></div>
        <div class="seg"><button class="${tankView === 'aqua' ? 'on' : ''}" data-v="aqua">수조</button><button class="${tankView === 'list' ? 'on' : ''}" data-v="list">목록</button></div></div>
      ${tankView === 'aqua' ? `
        <div class="aqua" id="aqua">
          <div class="aq-light"></div>
          <svg class="aq-weed" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
            <path d="M40 120 C30 90 52 70 38 40 C30 22 44 10 40 0" /><path d="M58 120 C66 96 50 80 62 56" />
            <path d="M330 120 C340 92 318 74 334 44 C342 28 330 16 336 4" /><path d="M352 120 C344 100 360 86 350 66" />
          </svg>
          <div class="aq-sand"></div>
          <div class="aq-bub" style="left:22%"></div><div class="aq-bub b2" style="left:78%"></div>
          ${items.map(({ it, n, info }) => `<button class="fishy ${it.g ? 'gold' : ''} ${tankSel === n ? 'sel' : ''}" data-n="${n}" aria-label="${esc(info.f[1])}"><span class="body">${art(it.k, info.f[0])}</span></button>`).join('')}
          ${!items.length ? `<div class="aq-empty">아직 아무도 없어요. 낚은 물고기를 수조에 넣으면 여기서 헤엄쳐요.</div>` : ''}
        </div>
        ${sel ? `<div class="fishcard"><div class="em ${sel.it.g ? 'gold' : ''}">${art(sel.it.k, sel.info.f[0])}</div>
          <div class="body"><div class="nm">${sel.it.g ? '황금 ' : ''}${esc(sel.info.f[1])} <span style="color:${TIERS[sel.info.tier].color};font-size:12px;font-weight:600">${sel.info.sig ? sigLabel(sel.info.stage) : TIERS[sel.info.tier].label}</span></div>
            <div class="ds">${fmtSize(sel.it.s)}. ${esc(sel.info.f[4])}</div>
            <div class="ds">${esc(sel.info.r.name)}${sel.it.c ? `, ${esc(sel.it.c)}와 낚음` : ''}</div>
            <div class="acts"><button class="btn sm" data-sell="${sel.n}">팔기, 조개 ${priceOf(sel.it)}개</button><button class="link" data-img="${sel.n}">어탁 이미지 저장</button></div></div></div>`
          : items.length ? `<p class="shopnote" style="padding-top:10px">물고기를 누르면 자세히 볼 수 있어요.</p>` : ''}`
      : (items.length ? `<div class="tanklist">${items.slice().reverse().map(({ it, n, info }) => `
        <div class="titem"><div class="em ${it.g ? 'gold' : ''}">${art(it.k, info.f[0])}</div>
          <div class="body"><div class="nm">${it.g ? '황금 ' : ''}${esc(info.f[1])} <span style="color:${TIERS[info.tier].color};font-size:12px;font-weight:600">${info.sig ? sigLabel(info.stage) : TIERS[info.tier].label}</span></div>
          <div class="ds">${fmtSize(it.s)}, ${esc(info.r.name)}${it.c ? `, ${esc(it.c)}와 낚음` : ''}</div></div>
          <button class="link" data-img="${n}">이미지</button><button class="btn sm" data-sell="${n}">팔기 ${priceOf(it)}</button></div>`).join('')}</div>`
        : `<div class="empty">수조가 비어 있어요.</div>`)}
      ${commons.length ? `<div style="padding:4px 16px 16px"><button class="btn" id="sellcommon">일반 등급 모두 팔기 (${commons.length}마리, 조개 ${commons.reduce((a, it) => a + priceOf(it), 0)}개)</button></div>` : ''}`;
    main.querySelectorAll('.seg button').forEach(b => b.onclick = () => { tankView = b.dataset.v; tankSel = null; render(); });
    main.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => {
      const [it] = state.tank.splice(+b.dataset.sell, 1); sellItem(it); tankSel = null; render();
    });
    main.querySelectorAll('[data-img]').forEach(b => b.onclick = () => saveGyotaku(state.tank[+b.dataset.img]));
    const sc = document.getElementById('sellcommon');
    if (sc) sc.onclick = () => {
      if (!confirm(`일반 등급 ${commons.length}마리를 모두 팔까요? 황금 개체는 빼고 팔아요.`)) return;
      state.tank = state.tank.filter(it => !commons.includes(it)); commons.forEach(sellItem); tankSel = null; render();
    };
    if (tankView === 'aqua') startAqua(items);
  }

  // 수조 애니메이션
  function startAqua(items) {
    const aq = document.getElementById('aqua'); if (!aq) return;
    const W = aq.clientWidth, H = aq.clientHeight, SAND = 26;
    const prev = new Map(aquaFish.map(f => [f.n, f]));
    aquaFish = [];
    aq.querySelectorAll('.fishy').forEach(el => {
      const n = +el.dataset.n, x = items.find(i => i.n === n); if (!x) return;
      const { it, info } = x;
      const f0 = info.f, rel = f0[3] > f0[2] ? Math.min(1, Math.max(0, (it.s - f0[2]) / (f0[3] - f0[2]))) : 0.5;
      const px = Math.round([26, 32, 40, 52][info.tier] * (0.85 + rel * 0.3) * (info.sig ? 1 + 0.12 * info.stage : 1));
      el.style.fontSize = px + 'px';
      const kind = motionOf(f0[0]);
      const old = prev.get(n);
      const seed = hashStr(it.k + it.t);
      const fish = old && old.kind === kind ? { ...old, el } : {
        n, el, kind, px,
        x: (seed % 1000) / 1000 * (W - px),
        y: kind === 'float' ? 6 : kind === 'swim' ? 16 + ((seed >> 10) % 1000) / 1000 * (H - SAND - px - 30) : H - SAND - px * 0.8,
        vx: (kind === 'sink' ? 0 : (kind === 'crawl' ? 6 : kind === 'float' ? 8 : 18 + (3 - info.tier) * 6)) * ((seed & 1) ? 1 : -1),
        ty: null, pause: 0, phase: (seed % 628) / 100, rot: kind === 'sink' ? ((seed % 40) - 20) : 0,
      };
      fish.px = px;
      if (fish.kind === 'swim' && fish.ty === null) fish.ty = fish.y;
      aquaFish.push(fish);
      el.addEventListener('pointerdown', e => { e.stopPropagation(); tankSel = tankSel === n ? null : n; render(); });
    });
    aq.addEventListener('pointerdown', () => { if (tankSel !== null) { tankSel = null; render(); } });
    const place = f => {
      const bob = f.kind === 'swim' || f.kind === 'float' ? Math.sin(f.phase) * (f.kind === 'float' ? 2 : 3) : 0;
      // 이모지 물고기는 대부분 왼쪽을 본다 → 오른쪽으로 갈 때 뒤집는다
      f.el.style.transform = `translate(${f.x}px, ${f.y + bob}px) scaleX(${f.vx > 0 ? -1 : 1}) rotate(${f.rot}deg)`;
    };
    aquaFish.forEach(place);
    if (reduceMotion) return;
    let last = performance.now();
    cancelAnimationFrame(aquaRaf);
    const tick = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      for (const f of aquaFish) {
        if (f.kind === 'sink') continue;
        f.phase += dt * 2;
        if (f.pause > 0) { f.pause -= dt; place(f); continue; }
        f.x += f.vx * dt;
        if (f.x < 2) { f.x = 2; f.vx = Math.abs(f.vx); }
        if (f.x > W - f.px - 2) { f.x = W - f.px - 2; f.vx = -Math.abs(f.vx); }
        if (f.kind === 'swim') {
          if (Math.abs(f.y - f.ty) < 1 || Math.random() < dt * 0.15) f.ty = 12 + Math.random() * (H - SAND - f.px - 24);
          f.y += Math.sign(f.ty - f.y) * Math.min(Math.abs(f.ty - f.y), dt * 10);
          if (Math.random() < dt * 0.08) f.pause = 0.6 + Math.random() * 1.2;
          if (Math.random() < dt * 0.05) f.vx = -f.vx;
        } else if (f.kind === 'crawl' && Math.random() < dt * 0.1) f.pause = 1 + Math.random() * 2;
        place(f);
      }
      aquaRaf = requestAnimationFrame(tick);
    };
    aquaRaf = requestAnimationFrame(tick);
  }

  // ── 상점 화면
  function renderShop(main) {
    const rod = state.gear.rod, next = ROD[rod + 1];
    const row = (name, desc, cost, id, owned) => `<div class="sitem"><div class="body"><div class="nm">${name}</div><div class="ds">${desc}</div></div>
      ${owned ? `<span class="owned">${owned}</span>` : `<button class="btn sm ${state.shells < cost ? 'dim' : ''}" data-buy="${id}">조개 ${cost}</button>`}</div>`;
    main.innerHTML = `
      <div class="summary"><span class="n">${state.shells}</span><span class="of">조개 보유</span></div>
      <p class="shopnote">조개는 물고기를 팔거나 업적을 달성하면 생겨요. 업적 하나에 20개, 숨겨진 업적은 50개예요.</p>
      <div class="shop">
        <h3>장비</h3>
        ${row(next ? next.name : ROD[rod].name, next ? `챔질 판정 시간 ${Math.round((next.win - 1) * 100)}% 늘림, 릴 감기 초록 구간 넓힘. 지금은 ${ROD[rod].name}` : '가장 좋은 낚싯대를 쓰고 있어요', next?.cost, 'rod', next ? '' : '최고 단계')}
        ${row('떡밥', `다음 ${CHUM.uses}번 던질 때 희귀·전설 확률 ${CHUM.mult}배. 남은 횟수 ${state.gear.chum}`, CHUM.cost, 'chum')}
        ${row('지역 이동권', `캐릭터의 낚시터를 다른 지역으로 바꿀 때 써요. 가진 이동권 ${state.gear.tickets}장`, TICKET_COST, 'ticket')}
        ${row('고유종 다시 만들기권', `마음에 안 드는 고유종을 새로 만들어요. 도감의 고유종 탭에서 써요. 가진 권 ${state.gear.rerolls}장`, REROLL_COST, 'reroll')}
        ${row('수조 확장', state.tankCap < TANK_MAX ? `수조를 ${TANK_STEP}칸 넓혀요. 지금 ${state.tankCap}칸` : '수조가 가장 커요', tankCost(state.tankCap), 'tank', state.tankCap >= TANK_MAX ? `${TANK_MAX}칸` : '')}
        <h3>칭호</h3>
        ${SHOP_TITLES.map(t => row(t.title, '상점에서만 얻을 수 있는 칭호예요. 업적 탭에서 장착해요', t.cost, 'title:' + t.id, state.shopTitles.includes(t.id) ? '가지고 있음' : '')).join('')}
      </div>`;
    main.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => buy(b.dataset.buy));
  }
  function buy(id) {
    const fail = n => alert(`조개가 ${n - state.shells}개 모자라요.`);
    let cost;
    if (id === 'rod') cost = ROD[state.gear.rod + 1]?.cost;
    else if (id === 'chum') cost = CHUM.cost;
    else if (id === 'ticket') cost = TICKET_COST;
    else if (id === 'reroll') cost = REROLL_COST;
    else if (id === 'tank') cost = state.tankCap < TANK_MAX ? tankCost(state.tankCap) : null;
    else if (id.startsWith('title:')) cost = SHOP_TITLES.find(t => 'title:' + t.id === id)?.cost;
    if (cost == null) return;
    if (state.shells < cost) return fail(cost);
    spend(cost);
    if (id === 'rod') state.gear.rod += 1;
    else if (id === 'chum') state.gear.chum += CHUM.uses;
    else if (id === 'ticket') state.gear.tickets += 1;
    else if (id === 'reroll') state.gear.rerolls += 1;
    else if (id === 'tank') state.tankCap += TANK_STEP;
    else state.shopTitles.push(id.slice(6));
    save(); render();
  }

  // ── 어탁: 물고기 카드를 PNG로 저장
  function loadImg(src) {
    return new Promise(res => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  }
  async function saveGyotaku(it) {
    const as = artSrc(it.k);
    const img = as ? await loadImg(as.src) : null;
    const info = itemInfo(it); if (!info) return;
    const { r, f, tier } = info, t = TIERS[tier];
    const W = 720, H = 960, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const font = (w, px) => `${w} ${px}px Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif`;
    g.fillStyle = '#f8fafb'; g.fillRect(0, 0, W, H);
    // 위쪽: 낚시터 풍경
    g.fillStyle = r.water[0]; g.fillRect(0, 0, W, 150);
    g.fillStyle = r.water[1]; g.fillRect(0, 150, W, 330);
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2;
    for (let y = 172; y < 480; y += 26) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.font = '200px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (it.g) g.filter = 'sepia(1) saturate(3) hue-rotate(-12deg)';
    if (img) {
      const sz = 300, k = Math.min(sz / img.width, sz / img.height), w = img.width * k, h = img.height * k;
      g.save(); g.translate(W / 2, 315); if (as.flip) g.scale(-1, 1); g.drawImage(img, -w / 2, -h / 2, w, h); g.restore();
    }
    else g.fillText(f[0], W / 2, 320);
    g.filter = 'none';
    // 아래쪽: 기록
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = it.g ? '#a87800' : t.color; g.font = font(600, 28); g.fillText(`${info.sig ? sigLabel(info.stage) : t.label}${it.g ? ', 황금 개체' : ''}${it.i ? ', 다른 세계에서 옴' : ''}`, 56, 550);
    g.fillStyle = '#22313f'; g.font = font(700, 56); g.fillText((it.g ? '황금 ' : '') + f[1], 56, 618);
    g.font = font(700, 88); g.fillText(fmtSize(it.s), 56, 726);
    g.fillStyle = '#6a7886'; g.font = font(400, 30); g.fillText(f[4], 56, 782);
    g.strokeStyle = '#dfe5ea'; g.beginPath(); g.moveTo(56, 830); g.lineTo(W - 56, 830); g.stroke();
    const d = new Date(it.t);
    g.font = font(400, 26);
    g.fillText(`${r.name}${it.c ? `, ${it.c}와 함께` : ''}`, 56, 878);
    g.fillText(`${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일${titleName(state.title) ? `, ${titleName(state.title)}` : ''}`, 56, 916);
    g.textAlign = 'right'; g.fillStyle = '#9aa5b1'; g.fillText('리스 낚시터', W - 56, 916);
    cv.toBlob(blob => {
      if (!blob) return alert('이미지를 만들지 못했어요.');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `risu_fishing_${it.k.replace(':', '_')}_${String(it.s).replace('.', '_')}.png`; // 한글 파일명은 일부 브라우저가 무시해서 영문으로
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  }

  // ── 업적 화면
  function renderAch(main) {
    const got = ACHIEVEMENTS.filter(a => state.ach[a.id]).length;
    main.innerHTML = `
      <div class="summary"><span class="n">${got}</span><span class="of">/ ${ACHIEVEMENTS.length}개 달성</span></div>
      <div class="achs">${ACHIEVEMENTS.map(a => {
        const at = state.ach[a.id];
        if (!at && a.hidden) return `<div class="ach"><div class="mark">?</div><div class="body"><div class="nm">숨겨진 업적</div><div class="ds">조건은 달성하면 알 수 있어요</div></div></div>`;
        const d = at ? new Date(at) : null;
        return `<div class="ach ${at ? 'got' : ''}"><div class="mark">${at ? '✓' : ''}</div>
          <div class="body"><div class="nm">${esc(a.name)}</div><div class="ds">${at ? `${esc(a.desc)}<br>칭호: ${esc(a.title)}, ${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} 달성` : esc(a.hint)}</div></div>
          ${at ? `<button class="eq ${state.title === a.id ? 'on' : ''}" data-id="${a.id}">${state.title === a.id ? '장착 중' : '장착'}</button>` : ''}</div>`;
      }).join('')}
      ${state.shopTitles.length ? `<h3 class="subh">상점에서 산 칭호</h3>${SHOP_TITLES.filter(t => state.shopTitles.includes(t.id)).map(t => `<div class="ach got"><div class="mark">✓</div><div class="body"><div class="nm">${esc(t.title)}</div></div>
        <button class="eq ${state.title === 'shop:' + t.id ? 'on' : ''}" data-id="shop:${t.id}">${state.title === 'shop:' + t.id ? '장착 중' : '장착'}</button></div>`).join('')}` : ''}</div>`;
    main.querySelectorAll('.eq').forEach(b => b.onclick = () => {
      state.title = state.title === b.dataset.id ? null : b.dataset.id; save(); render();
    });
  }

  function sigToast(charName, st) {
    const box = document.getElementById('toasts'); if (!box) return;
    const el = document.createElement('div'); el.className = 'toast';
    el.innerHTML = `${esc(charName || '이 캐릭터')}의 낚시터에 ${josa(sigLabel(st), '이', '가')} 나타났어요<small>아주 드물게 걸려요. 도감의 고유종 탭에서 확인할 수 있어요.</small>`;
    box.appendChild(el); setTimeout(() => el.remove(), 4500);
  }

  function toast(a) {
    const box = document.getElementById('toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `업적 달성: ${esc(a.name)}<small>조개 ${achReward(a)}개와 칭호 '${esc(a.title)}'을(를) 받았어요.</small>`;
    box.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  // ── 설정 화면
  function renderSettings(main) {
    const c = state.counters;
    const aux = Object.keys(AUX_LABELS).reduce((a, k) => a + (c[k] || 0), 0);
    main.innerHTML = `
      <div class="sec"><h3>소리와 진동</h3>
        <div class="row"><span>효과음</span><button class="tog ${state.settings.sound ? 'on' : ''}" data-k="sound"></button></div>
        <div class="row"><span>진동 (지원하는 기기만)</span><button class="tog ${state.settings.vibrate ? 'on' : ''}" data-k="vibrate"></button></div>
      </div>
      <div class="sec"><h3>미끼를 얻은 곳</h3><p>AI 답변을 한 번 받을 때마다 미끼 1개가 생겨요.</p>
        <div class="row"><span>메인 답변</span><span>${c.main}</span></div>
        ${Object.entries(AUX_LABELS).map(([k, l]) => `<div class="row"><span>${l}</span><span>${c[k] || 0}</span></div>`).join('')}
        <div class="row total"><span>합계</span><span>${aux + c.main}</span></div>
      </div>
      <div class="sec"><h3>낚시 기록</h3>
        <div class="row"><span>던진 횟수</span><span>${c.casts}</span></div>
        <div class="row"><span>낚은 횟수</span><span>${c.catches}</span></div>
        <div class="row"><span>놓침 / 너무 일찍 / 가짜 입질</span><span>${c.miss} / ${c.early} / ${c.fake}</span></div>
        <div class="row"><span>황금 개체 / 이세계</span><span>${c.golden} / ${c.isekai}</span></div>
        <div class="row"><span>낚시한 캐릭터 수</span><span>${Object.keys(state.regions).length}</span></div>
      </div>
      <div class="sec" style="border:none"><h3>백업</h3><p>기기를 옮기거나 초기화하기 전에 기록을 파일로 저장해 두세요.</p>
        <button class="btn" id="exp">파일로 저장</button><button class="btn" id="imp">파일에서 불러오기</button>
        <input type="file" id="file" accept="application/json,.json" style="display:none">
      </div>`;
    main.querySelectorAll('.tog').forEach(b => b.onclick = () => { const k = b.dataset.k; state.settings[k] = !state.settings[k]; save(); render(); });
    document.getElementById('exp').onclick = exportJson;
    const file = document.getElementById('file');
    document.getElementById('imp').onclick = () => file.click();
    file.onchange = async () => {
      const f = file.files?.[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (data?.v !== 1 || typeof data.dex !== 'object') throw new Error('낚시터 백업 파일이 아니에요');
        if (!confirm('지금 기록을 백업 파일 내용으로 덮어쓸까요?')) return;
        state = mergeState(data); save(); render();
        alert('불러오기 완료!');
      } catch (e) { alert('불러오기 실패: ' + e.message); }
    };
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const d = new Date();
    a.href = URL.createObjectURL(blob);
    a.download = `risu_fishing_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ─────────────────────────────── 열기/닫기 ───────────────────────────────
  async function open(which) {
    await loadArtBase();
    tab = which;
    spot = await currentSpot();
    dexRegion = spot.regionId; dexDetail = null;
    visible = true;
    render();
    await Risuai.showContainer('fullscreen');
    if (state.unseen.length) {
      state.unseen.forEach((id, i) => ACH_BY_ID[id] && setTimeout(() => toast(ACH_BY_ID[id]), 300 + i * 400));
      state.unseen = []; save(); updateBadge();
    }
  }
  async function close() {
    visible = false;
    cancelAnimationFrame(aquaRaf);
    clearFishing();
    resolvePending();
    clearTimeout(saveTimer);
    try { await Risuai.pluginStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
    await Risuai.hideContainer();
  }

  // 버튼은 각각 따로 등록 — 하나가 실패해도 나머지는 뜨게
  const reg = async (label, fn) => { try { await fn(); } catch (e) { console.log(`[낚시터] ${label} 등록 실패: ${e?.message || e}`); } };
  await reg('채팅 메뉴 버튼', () => Risuai.registerButton(
    { name: '낚시하기', icon: '🎣', iconType: 'html', location: 'chat', id: 'risu-fishing-cast' },
    () => open('fish')));
  await reg('설정 메뉴', () => Risuai.registerSetting('🎣 리스 낚시터', () => open('fish'), '🎣', 'html', 'risu-fishing-setting'));
  await reg('사이드바 버튼', () => Risuai.registerButton(
    { name: '낚시 도감', icon: '📖', iconType: 'html', location: 'hamburger', id: 'risu-fishing-dex' },
    () => open('dex')));

  await reg('언로드 콜백', () => Risuai.onUnload(async () => {
    clearFishing();
    if (hookState === 'on') {
      try { await Risuai.removeRisuReplacer('afterRequest', onAfterRequest); } catch (_) {}
    }
    try { await Risuai.pluginStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }));

  checkAch();
  if (state.unseen.length) updateBadge();
  console.log(`[낚시터] v1.1.0 로드 · 미끼 ${state.bait} · 도감 ${Object.keys(state.dex).length}/${TOTAL_SPECIES}`);

  // 집계 훅은 맨 마지막에, 기다리지 않고 등록
  (async () => {
    try {
      const ok = await Risuai.requestPluginPermission('replacer');
      if (!ok) { hookState = 'off'; return; }
      await Risuai.addRisuReplacer('afterRequest', onAfterRequest);
      await Risuai.addRisuChatListener('output', onChatOutput);
      hookState = 'on';
      console.log('[낚시터] 호출 집계 시작');
    } catch (e) {
      hookState = 'off';
      console.log('[낚시터] 집계 훅 등록 실패: ' + (e?.message || e));
    }
  })();
})();
