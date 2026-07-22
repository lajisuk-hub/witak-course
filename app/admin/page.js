'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_SECTIONS } from '@/lib/sampleSections';
import { loadSections, saveSections } from '@/lib/store';

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

  // 문서 꼭지 (이 컴퓨터에만 저장)
  const [list, setList] = useState(DEFAULT_SECTIONS);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    setList(loadSections(DEFAULT_SECTIONS));
    const saved = sessionStorage.getItem(PW_KEY);
    if (saved) {
      setPw(saved);
      enter(saved);
    }
    setForm((f) => ({ ...f, due_date: ymd(new Date()) }));
  }, []);

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

  const doneCount = (phone) => checks.filter((c) => c.phone === phone).length;
  const pct = (phone) => (tasks.length ? Math.round((doneCount(phone) / tasks.length) * 100) : 0);

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
          <div className={tab === 'sections' ? 'on' : ''} onClick={() => setTab('sections')} style={{ cursor: 'pointer' }}>
            문서 꼭지
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
              <h2>올린 할 일 ({tasks.length}개)</h2>
              {tasks.length === 0 ? (
                <p className="sub" style={{ margin: 0 }}>아직 올린 할 일이 없습니다.</p>
              ) : (
                tasks.map((t) => {
                  const n = checks.filter((c) => c.task_id === t.id).length;
                  return (
                    <div className="item" key={t.id}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <div>
                          <span className="week">{t.due_date.slice(5).replace('-', '/')}</span>
                          <span className="name">{t.title}</span>
                          {t.step != null && <span className="badge off">{t.step}차시</span>}
                          <span className="badge ok">{n}명 완료</span>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => del(t.id)}>
                          지우기
                        </button>
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
                      {doneCount(s.phone)} / {tasks.length}
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

        {/* ── 문서 꼭지 ── */}
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
