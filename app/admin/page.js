'use client';

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_SECTIONS } from '@/lib/sampleSections';
import { loadSections, saveSections } from '@/lib/store';
import { FORMS } from '@/lib/forms';
import { MEMO } from '@/app/CalendarBoard';

const PW_KEY = 'witak-admin-pw';

function ymd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function Admin() {
  const [pw, setPw] = useState('');
  const [ok, setOk] = useState(false);
  const [tab, setTab] = useState('plan'); // plan · progress · sections

  const [students, setStudents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [checks, setChecks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // 새 할 일
  const [form, setForm] = useState({ due_date: '', title: '', detail: '', step: '' });
  // 고치는 중인 할 일
  const [edit, setEdit] = useState(null);
  // 새 메모·전달사항 (step = -1 로 저장한다)
  const [memo, setMemo] = useState({ due_date: '', title: '', detail: '' });

  // 문서 항목 (이 컴퓨터에만 저장)
  const [list, setList] = useState(DEFAULT_SECTIONS);
  const [open, setOpen] = useState(null);

  // 문서별 샘플 올리기
  const sampleRef = useRef(null);
  const [upKind, setUpKind] = useState(null); // 지금 올리는 문서 종류
  const [upBusy, setUpBusy] = useState('');
  const [upDone, setUpDone] = useState('');
  const [formFiles, setFormFiles] = useState({}); // 올라와 있는 서식 목록

  async function loadForms(pwd = pw) {
    try {
      const res = await fetch('/api/sample-upload', { headers: { 'x-admin-pw': pwd } });
      const data = await res.json();
      if (res.ok) setFormFiles(data.files || {});
    } catch {
      /* 목록은 못 불러와도 올리기는 된다 */
    }
  }

  function pickFile(kind) {
    setUpKind(kind);
    setUpDone('');
    setError('');
    setTimeout(() => sampleRef.current?.click(), 0);
  }

  async function uploadSample(e) {
    const f = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!f || !upKind) return;
    if (!f.name.toLowerCase().endsWith('.hwpx')) {
      setError('한글 문서(.hwpx) 파일만 올릴 수 있습니다.');
      return;
    }
    setError('');
    setUpDone('');
    setUpBusy('올리기 준비 중입니다...');
    try {
      const ticket = await fetch('/api/sample-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pw': pw },
        body: JSON.stringify({ kind: upKind }),
      });
      const info = await ticket.json();
      if (!ticket.ok) throw new Error(info.error || '올리기 표를 받지 못했습니다');

      const mb = Math.max(1, Math.round(f.size / 1024 / 1024));
      setUpBusy(`올리는 중입니다... (${mb}MB)`);
      const put = await fetch(info.url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: f,
      });
      if (!put.ok) throw new Error('올리지 못했습니다. 잠시 뒤 다시 해보세요.');

      setUpBusy('마무리하는 중입니다...');
      const fin = await fetch('/api/sample-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pw': pw },
        body: JSON.stringify({ kind: upKind, finalize: info.temp }),
      });
      const finData = await fin.json();
      if (!fin.ok) throw new Error(finData.error || '마무리하지 못했습니다');

      const name = (FORMS.find((x) => x.key === upKind) || {}).name || '';
      setUpDone(`${name} 서식을 올렸습니다. (${f.name})`);
      await loadForms();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpBusy('');
      setUpKind(null);
    }
  }

  useEffect(() => {
    setList(loadSections(DEFAULT_SECTIONS));
    const saved = sessionStorage.getItem(PW_KEY);
    if (saved) {
      setPw(saved);
      enter(saved);
    }
    const t = ymd(new Date());
    setForm((f) => ({ ...f, due_date: t }));
    setMemo((m) => ({ ...m, due_date: t }));
  }, []);

  async function addMemo() {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pw': pw },
        body: JSON.stringify({ ...memo, step: MEMO }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '올리지 못했습니다');
      setMemo({ due_date: memo.due_date, title: '', detail: '' });
      await load(pw);
      setMsg('메모를 올렸습니다');
      setTimeout(() => setMsg(''), 1800);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function load(pwd) {
    const res = await fetch('/api/admin', { headers: { 'x-admin-pw': pwd } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '불러오지 못했습니다');
    setStudents(data.students || []);
    setTasks(data.tasks || []);
    setChecks(data.checks || []);
  }

  async function enter(pwd = pw) {
    setError('');
    setBusy(true);
    try {
      await load(pwd);
      await loadForms(pwd);
      sessionStorage.setItem(PW_KEY, pwd);
      setOk(true);
    } catch (e) {
      setError(e.message);
      setOk(false);
    } finally {
      setBusy(false);
    }
  }

  async function addTask() {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pw': pw },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '올리지 못했습니다');
      setForm({ due_date: form.due_date, title: '', detail: '', step: '' });
      await load(pw);
      setMsg('올렸습니다');
      setTimeout(() => setMsg(''), 1800);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!edit) return;
    setError('');
    setBusy(true);
    try {
      const orig = tasks.find((t) => t.id === edit.id);
      const res = await fetch('/api/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-pw': pw },
        body: JSON.stringify({
          action: 'updateTask',
          id: edit.id,
          due_date: edit.due_date,
          title: edit.title,
          detail: edit.detail,
          // 전달사항은 계속 전달사항으로 둔다
          step: orig && orig.step === MEMO ? MEMO : edit.step,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '고치지 못했습니다');
      setEdit(null);
      await load(pw);
      setMsg('고쳤습니다');
      setTimeout(() => setMsg(''), 1800);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function del(id) {
    if (!confirm('이 할 일을 지울까요? 수강생이 누른 체크도 함께 사라집니다.')) return;
    setBusy(true);
    try {
      await fetch('/api/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-pw': pw },
        body: JSON.stringify({ action: 'deleteTask', id }),
      });
      await load(pw);
    } finally {
      setBusy(false);
    }
  }

  async function setAllowed(phone, allow) {
    setBusy(true);
    try {
      await fetch('/api/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-pw': pw },
        body: JSON.stringify({ action: 'setAllowed', phone, allowed: allow }),
      });
      await load(pw);
    } finally {
      setBusy(false);
    }
  }

  function updateSection(i, key, value) {
    const next = list.map((s, k) => (k === i ? { ...s, [key]: value } : s));
    setList(next);
    saveSections(next);
    setMsg('저장됨');
    setTimeout(() => setMsg(''), 1200);
  }

  // ── 로그인 화면 ──
  if (!ok) {
    return (
      <>
        <div className="head">
          <h1>관리자 화면</h1>
          <p>진행자(원장님) 전용입니다</p>
        </div>
        <div className="wrap" style={{ maxWidth: 420 }}>
          {error && <div className="err">{error}</div>}
          <div className="card">
            <label>비밀번호</label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && enter()}
            />
            <div className="row right" style={{ marginTop: 14 }}>
              <a className="btn btn-ghost" href="/">
                돌아가기
              </a>
              <button className="btn" onClick={() => enter()} disabled={busy || !pw}>
                들어가기
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const todos = tasks.filter((t) => t.step !== MEMO);
  const doneCount = (phone) => checks.filter((c) => c.phone === phone).length;
  const pct = (phone) => (todos.length ? Math.round((doneCount(phone) / todos.length) * 100) : 0);

  return (
    <>
      <div className="head">
        <h1>관리자 화면</h1>
        <p>할 일을 올리고, 수강생 진도를 확인합니다</p>
        <a href="/">← 수강생 화면 보기</a>
      </div>

      <div className="wrap">
        {error && <div className="err">{error}</div>}
        {msg && <div className="info">{msg}</div>}

        <div className="steps">
          <div className={tab === 'plan' ? 'on' : ''} onClick={() => setTab('plan')} style={{ cursor: 'pointer' }}>
            달력 할 일
          </div>
          <div className={tab === 'progress' ? 'on' : ''} onClick={() => setTab('progress')} style={{ cursor: 'pointer' }}>
            수강생 진도 ({students.length}명)
          </div>
          <div className={tab === 'sample' ? 'on' : ''} onClick={() => setTab('sample')} style={{ cursor: 'pointer' }}>
            문서 샘플
          </div>
          <div className={tab === 'sections' ? 'on' : ''} onClick={() => setTab('sections')} style={{ cursor: 'pointer' }}>
            문서 항목
          </div>
        </div>

        {/* ── 달력 할 일 ── */}
        {tab === 'plan' && (
          <>
            <div className="card">
              <h2>할 일 올리기</h2>
              <p className="sub">여기 올리면 수강생 달력에 바로 나타납니다.</p>

              <div className="grid2">
                <div>
                  <label>날짜</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  />
                </div>
                <div>
                  <label>관련 차시 (없으면 비워 두세요)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.step}
                    onChange={(e) => setForm({ ...form, step: e.target.value })}
                    placeholder="예) 1"
                  />
                </div>
              </div>

              <label>할 일</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="예) 자기소개서 초안 쓰기"
              />

              <label>설명 (없어도 됩니다)</label>
              <textarea
                value={form.detail}
                onChange={(e) => setForm({ ...form, detail: e.target.value })}
                placeholder="예) 1차시 화면에서 키워드만 채우고 만들기 버튼을 누르세요"
                style={{ minHeight: 80 }}
              />

              <div className="row right" style={{ marginTop: 12 }}>
                <button
                  className="btn btn-gold"
                  onClick={addTask}
                  disabled={busy || !form.due_date || !form.title.trim()}
                >
                  달력에 올리기
                </button>
              </div>
            </div>

            <div className="card">
              <h2>메모 · 전달사항 올리기</h2>
              <p className="sub">
                강의 내용, 공지, 준비물처럼 <b>체크가 필요 없는 안내</b>입니다. 수강생이 그 날짜를
                누르면 안내로 보입니다.
              </p>

              <label>날짜</label>
              <input
                type="date"
                value={memo.due_date}
                onChange={(e) => setMemo({ ...memo, due_date: e.target.value })}
              />

              <label>제목</label>
              <input
                type="text"
                value={memo.title}
                onChange={(e) => setMemo({ ...memo, title: e.target.value })}
                placeholder="예) 3회차 강의 — 예산서 작성 실습"
              />

              <label>내용</label>
              <textarea
                value={memo.detail}
                onChange={(e) => setMemo({ ...memo, detail: e.target.value })}
                placeholder={'예) 오늘 강의에서 다룬 것\n· 세입 항목 잡는 법\n· 정원 45명 기준 산출 근거\n다음 시간까지 반별 구성 정해 오세요'}
                style={{ minHeight: 110 }}
              />

              <div className="row right" style={{ marginTop: 12 }}>
                <button
                  className="btn"
                  onClick={addMemo}
                  disabled={busy || !memo.due_date || !memo.title.trim()}
                >
                  메모 올리기
                </button>
              </div>
            </div>

            <div className="card">
              <h2>올린 할 일 ({tasks.length}개)</h2>
              <p className="sub">
                제목을 고치시려면 <b>고치기</b>를 누르세요. 날짜·설명·차시도 함께 바꿀 수 있습니다.
              </p>

              {tasks.length === 0 ? (
                <p className="sub" style={{ margin: 0 }}>아직 올린 할 일이 없습니다.</p>
              ) : (
                tasks.map((t) => {
                  const n = checks.filter((c) => c.task_id === t.id).length;
                  const editing = edit && edit.id === t.id;

                  if (editing) {
                    return (
                      <div className="item" key={t.id} style={{ borderColor: 'var(--gold)' }}>
                        <div className="grid2">
                          <div>
                            <label>날짜</label>
                            <input
                              type="date"
                              value={edit.due_date}
                              onChange={(e) => setEdit({ ...edit, due_date: e.target.value })}
                            />
                          </div>
                          <div>
                            <label>관련 차시 (없으면 비움)</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={edit.step}
                              onChange={(e) => setEdit({ ...edit, step: e.target.value })}
                              placeholder="예) 1"
                              disabled={t.step === MEMO}
                            />
                          </div>
                        </div>

                        <label>{t.step === MEMO ? '제목' : '할 일'}</label>
                        <input
                          type="text"
                          value={edit.title}
                          onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                        />

                        <label>설명</label>
                        <textarea
                          value={edit.detail}
                          onChange={(e) => setEdit({ ...edit, detail: e.target.value })}
                          style={{ minHeight: 80 }}
                        />

                        <div className="row right" style={{ marginTop: 12 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>
                            취소
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={saveEdit}
                            disabled={busy || !edit.due_date || !edit.title.trim()}
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="item" key={t.id}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <div>
                          <span className="week">{t.due_date.slice(5).replace('-', '/')}</span>
                          <span className="name">{t.title}</span>
                          {t.step === MEMO ? (
                            <span className="badge mine">전달사항</span>
                          ) : (
                            <>
                              {t.step != null && <span className="badge off">{t.step}차시</span>}
                              <span className="badge ok">{n}명 완료</span>
                            </>
                          )}
                        </div>
                        <div className="row">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              setEdit({
                                id: t.id,
                                due_date: t.due_date,
                                title: t.title,
                                detail: t.detail || '',
                                step: t.step == null || t.step === MEMO ? '' : String(t.step),
                              })
                            }
                          >
                            고치기
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => del(t.id)}>
                            지우기
                          </button>
                        </div>
                      </div>
                      {t.detail && <div className="meta">{t.detail}</div>}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ── 수강생 진도 ── */}
        {tab === 'progress' && (
          <div className="card">
            <h2>수강생 진도</h2>
            <p className="sub">
              전화번호로 들어온 분들입니다. 모르는 번호는 <b>이용 막기</b>로 잠글 수 있습니다.
            </p>

            {students.length === 0 ? (
              <p className="sub" style={{ margin: 0 }}>아직 들어온 사람이 없습니다.</p>
            ) : (
              students.map((s) => (
                <div className="item" key={s.phone}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <span className="name">{s.name}</span>
                      <span className="meta" style={{ marginLeft: 8 }}>{s.phone}</span>
                      {!s.allowed && <span className="badge off">막힘</span>}
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setAllowed(s.phone, !s.allowed)}
                      disabled={busy}
                    >
                      {s.allowed ? '이용 막기' : '다시 열기'}
                    </button>
                  </div>
                  <div className="meta">
                    {s.region || '지역 미기재'}
                    {s.target ? ` → ${s.target} 지원` : ''} · 마지막 접속{' '}
                    {String(s.last_seen).slice(0, 10)}
                  </div>
                  <div className="meter" style={{ margin: '8px 0 0' }}>
                    <b>
                      {doneCount(s.phone)} / {todos.length}
                    </b>
                    <div className="bar">
                      <i style={{ width: `${pct(s.phone)}%` }} />
                    </div>
                    <span className="target">{pct(s.phone)}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── 문서 샘플 올리기 ── */}
        {tab === 'sample' && (
          <>
            <div className="card welcome">
              <h2>문서마다 서식을 따로 올려 주세요</h2>
              <p>
                여기 올리신 한글 문서의 <b>글꼴 · 글자크기 · 줄간격 · 여백</b>을 그대로 물려받아,
                수강생 화면에서 <b>그 문서 하나만</b> 만들어 드립니다.
                <br />
                예) 자기소개서 서식을 올리시면 → 수강생이 쓴 자기소개서가 그 서식으로 나옵니다.
                <br />
                <b>로그인한 수강생만</b> 받을 수 있고, 주소를 알아도 밖에서는 열 수 없습니다.
              </p>
            </div>

            {upBusy && (
              <div className="info">
                <span className="spin" style={{ borderColor: '#1a3a5c', borderTopColor: 'transparent' }} />
                {upBusy}
              </div>
            )}
            {upDone && <div className="info">{upDone}</div>}

            <div className="card">
              <h2>문서 서식 목록</h2>
              <p className="sub">
                한글에서 <b>다른 이름으로 저장 → 한글 문서(*.hwpx)</b> 로 저장한 파일을 올려
                주세요. 다시 올리면 새 것으로 바뀌고, 예전 것은 보관됩니다.
              </p>

              {FORMS.map((f) => {
                const up = formFiles[f.key];
                return (
                  <div className="item" key={f.key}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <div>
                        <span className="name">{f.name}</span>
                        {f.step != null && <span className="badge off">{f.step}차시</span>}
                        {up ? (
                          <span className="badge ok">올림</span>
                        ) : (
                          <span className="badge new">아직 없음</span>
                        )}
                      </div>
                      <button
                        className={`btn btn-sm ${up ? 'btn-ghost' : 'btn-gold'}`}
                        onClick={() => pickFile(f.key)}
                        disabled={!!upBusy}
                      >
                        {up ? '바꾸기' : '올리기'}
                      </button>
                    </div>
                    <div className="meta">
                      {f.desc}
                      {up && (
                        <>
                          <br />▸ 올린 날 {String(up.at).slice(0, 10)} · 크기{' '}
                          {Math.max(1, Math.round(up.size / 1024))}KB
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              <input
                ref={sampleRef}
                type="file"
                accept=".hwpx"
                onChange={uploadSample}
                style={{ display: 'none' }}
              />
            </div>

            <div className="card">
              <h2>서식 만드실 때</h2>
              <ul className="pts">
                <li>
                  그 문서 <b>하나만</b> 담아 주세요. (자기소개서 서식에는 자기소개서만)
                </li>
                <li>
                  <b>본문 글꼴을 한 가지로 통일</b>해 주시면 결과가 깔끔합니다.
                </li>
                <li>
                  제목은 본문보다 <b>큰 글씨</b>로 해주세요. 그걸 보고 제목 서식을 알아냅니다.
                </li>
                <li>
                  내용은 <b>본보기로 채워 두셔도 됩니다.</b> 수강생 문서에는 수강생이 쓴 내용이
                  들어갑니다.
                </li>
                <li>
                  <b>전체 문서</b>는 과정을 마친 수강생이 각 문서를 모아 정리할 때 쓰는 서식입니다.
                </li>
              </ul>
            </div>
          </>
        )}

        {/* ── 문서 항목 ── */}
        {tab === 'sections' && (
          <>
            <div className="card">
              <div className="info">
                꼭지 <b>{list.length}개</b>. 공고문 목차와 짝을 지을 때 쓰는 이름·관련어입니다.
                고치면 이 컴퓨터에 바로 저장됩니다.
              </div>
            </div>
            {list.map((s, i) => (
              <div className="card" key={s.id} style={{ padding: 16 }}>
                <div
                  className="row"
                  style={{ cursor: 'pointer', justifyContent: 'space-between' }}
                  onClick={() => setOpen(open === i ? null : i)}
                >
                  <div>
                    <span className="no">{i + 1}</span>
                    <b>{s.name}</b>
                    {s.step && <span className="badge off">{s.step}차시</span>}
                  </div>
                  <span style={{ color: 'var(--muted)' }}>{open === i ? '▲' : '▼'}</span>
                </div>

                {open === i && (
                  <div style={{ marginTop: 12 }}>
                    <label>꼭지 이름</label>
                    <input
                      type="text"
                      value={s.name}
                      onChange={(e) => updateSection(i, 'name', e.target.value)}
                    />
                    <label>관련어 (쉼표로 구분)</label>
                    <input
                      type="text"
                      value={(s.keywords || []).join(', ')}
                      onChange={(e) =>
                        updateSection(
                          i,
                          'keywords',
                          e.target.value.split(',').map((v) => v.trim()).filter(Boolean)
                        )
                      }
                    />
                    <label>작성 요령</label>
                    <textarea
                      value={s.guide || ''}
                      onChange={(e) => updateSection(i, 'guide', e.target.value)}
                      style={{ minHeight: 70 }}
                    />
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
