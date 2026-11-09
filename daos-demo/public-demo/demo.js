const byId = id => document.getElementById(id);
const total = 3;
let online = true;
let baseline = 0;
let daos = 0;
let pending = 0;

function render() {
  byId('connection').textContent = online ? '서버 연결 끊기' : '서버 복구';
  byId('server').textContent = online ? '서버 연결됨' : '서버 연결 끊김';
  byId('baseline-state').textContent = online ? '서버에서 작업표를 조회합니다.' : '작업표 조회와 배송 완료 기록이 중단됩니다.';
  byId('daos-state').textContent = online ? '작업표 저장됨 · 미동기화 0건' : `저장된 작업표 사용 중 · 미동기화 ${pending}건`;
  byId('baseline-count').textContent = `${baseline} / ${total}건`;
  byId('daos-count').textContent = `${daos} / ${total}건`;
  byId('baseline-deliver').disabled = !online || baseline === total;
  byId('daos-deliver').disabled = daos === total;
}

byId('connection').onclick = () => {
  online = !online;
  if (online) pending = 0;
  render();
};
byId('reset').onclick = () => {
  online = true;
  baseline = daos = pending = 0;
  render();
};
byId('baseline-deliver').onclick = () => {
  if (online && baseline < total) baseline += 1;
  render();
};
byId('daos-deliver').onclick = () => {
  if (daos < total) {
    daos += 1;
    if (!online) pending += 1;
  }
  render();
};
render();
