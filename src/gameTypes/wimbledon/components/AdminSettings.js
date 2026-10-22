import React, { useCallback, useEffect, useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaBolt, FaExclamationTriangle, FaFileImport, FaSave, FaTrophy, FaUpload } from 'react-icons/fa';
import { auth, db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { createActiveMensDrawRows } from '../constants/activeMensPlayers';
import {
  fetchWimbledonBundle,
  importWimbledonEntrants,
  importWimbledonRoundOf32Entrants,
  resetWimbledonLeagueToRoundOf32,
  saveOfficialWimbledonResults
} from '../services/wimbledonService';
import { parseEntrantsImport } from '../utils/drawUtils';
import DrawBracket from './DrawBracket';

const SETTINGS_TABS = Object.freeze(['draw', 'round32', 'results', 'scoring']);

const AdminSettings = ({ leagueId, urlParams = {} }) => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [bundle, setBundle] = useState(null);
  const [tab, setTab] = useState(() => (
    SETTINGS_TABS.includes(urlParams.tab) ? urlParams.tab : 'draw'
  ));
  const [importText, setImportText] = useState('');
  const [round32ImportText, setRound32ImportText] = useState('');
  const [results, setResults] = useState({});
  const [scoring, setScoring] = useState(null);
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [fillingDraw, setFillingDraw] = useState(false);
  const [trimmingDraw, setTrimmingDraw] = useState(false);
  const [importingRound32, setImportingRound32] = useState(false);
  const [csvFileName, setCsvFileName] = useState('');
  const [round32CsvFileName, setRound32CsvFileName] = useState('');
  const fileInputRef = useRef(null);
  const round32FileInputRef = useRef(null);

  const reload = useCallback(async () => {
    const next = await fetchWimbledonBundle(leagueId);
    setBundle(next);
    setResults(next.gameData?.officialResultsByMatchId || {});
    setScoring(next.scoring);
  }, [leagueId]);

  useEffect(() => { reload(); }, [reload]);

  const handleImport = async () => {
    try {
      const rows = parseEntrantsImport(importText);
      await importWimbledonEntrants(leagueId, rows, { uid: auth.currentUser?.uid, reason });
      await reload();
      setFeedback(`Imported ${rows.length} draw slots.`);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCsvFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      try {
        parseEntrantsImport(content);
        setImportText(content);
        setCsvFileName(file.name);
        setFeedback(`Loaded ${file.name}. Review the rows, then import the draw.`);
        setError('');
      } catch (err) {
        setError(err.message);
        setFeedback('');
      }
    };
    reader.onerror = () => {
      setError(`Unable to read ${file.name}`);
      setFeedback('');
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleRound32CsvFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      try {
        const rows = parseEntrantsImport(content);
        if (rows.length !== 32) {
          throw new Error(`Round of 32 import requires exactly 32 rows. Found ${rows.length}.`);
        }
        setRound32ImportText(content);
        setRound32CsvFileName(file.name);
        setFeedback(`Loaded ${file.name}. Review the 32 rows, then import the Round of 32.`);
        setError('');
      } catch (err) {
        setError(err.message);
        setFeedback('');
      }
    };
    reader.onerror = () => {
      setError(`Unable to read ${file.name}`);
      setFeedback('');
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleFillActiveMen = async () => {
    const occupiedSlots = Object.values(bundle?.gameData?.entrantsBySlot || {})
      .filter((entrant) => entrant?.name)
      .length;
    if (
      occupiedSlots > 0 &&
      !window.confirm(`Replace the current ${occupiedSlots} populated draw slots with the 128-player men's fixture?`)
    ) {
      return;
    }

    try {
      setFillingDraw(true);
      const rows = createActiveMensDrawRows();
      await importWimbledonEntrants(leagueId, rows, {
        uid: auth.currentUser?.uid,
        reason: reason.trim() || 'Filled draw from active men fixture'
      });
      await reload();
      setFeedback('Filled all 128 draw slots with the active men fixture.');
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setFillingDraw(false);
    }
  };

  const handleTrimToRoundOf32 = async () => {
    if (
      !window.confirm(
        'Reset this league to a blank Round of 32 bracket? This clears every participant pick, clears official results, and reopens the bracket.'
      )
    ) {
      return;
    }

    try {
      setTrimmingDraw(true);
      const result = await resetWimbledonLeagueToRoundOf32(leagueId, {
        uid: auth.currentUser?.uid,
        reason: reason.trim()
      });
      await reload();
      setFeedback(`Reset ${result.resetEntryCount} participant bracket(s). The league now starts at Round of 32.`);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setTrimmingDraw(false);
    }
  };

  const handleImportRound32 = async () => {
    try {
      const rows = parseEntrantsImport(round32ImportText);
      if (rows.length !== 32) {
        throw new Error(`Round of 32 import requires exactly 32 rows. Found ${rows.length}.`);
      }

      if (
        !window.confirm(
          'Import these 32 players as the Round of 32 field? This clears every participant pick, clears official results, and reopens the bracket.'
        )
      ) {
        return;
      }

      setImportingRound32(true);
      const result = await importWimbledonRoundOf32Entrants(leagueId, rows, {
        uid: auth.currentUser?.uid,
        reason: reason.trim()
      });
      await reload();
      setFeedback(`Imported Round of 32 and reset ${result.resetEntryCount} participant bracket(s).`);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setImportingRound32(false);
    }
  };

  const handleSaveResults = async () => {
    try {
      await saveOfficialWimbledonResults(leagueId, results, { uid: auth.currentUser?.uid, reason });
      await reload();
      setFeedback('Official results saved and standings recalculated on next view.');
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveScoring = async () => {
    await setDoc(doc(db, 'leagues', leagueId, 'settings', 'scoring'), {
      ...scoring,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.currentUser?.uid || null
    }, { merge: true });
    setFeedback('Scoring settings saved.');
  };

  if (!bundle || !scoring) return <div className="p-8 text-center text-gray-500">Loading tournament settings…</div>;
  if (bundle.league?.ownerId !== auth.currentUser?.uid && !isAdmin) {
    return <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">You do not have permission to edit this tournament.</div>;
  }

  const round32ImportDisabled = importingRound32 || !round32ImportText.trim();
  const round32UpdateLabel = importingRound32 ? 'Updating Bracket...' : 'Update Bracket';

  const round32ImportPanel = (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
      <h2 className="flex items-center text-lg font-bold text-emerald-950"><FaFileImport className="mr-2 text-emerald-700" />Import Round of 32</h2>
      <p className="mt-2 text-sm text-emerald-900">Import exactly 32 rows in bracket order. This sets those slots as the Round of 32 field, clears every pick and official result, and reopens the bracket.</p>
      <p className="mt-2 text-xs text-emerald-800">CSV columns: <code>slot,name,seed,countryCode,entryStatus,externalId</code>. Use slot 1-32 for a fresh 32-player field, or existing permanent slot IDs if keeping original draw slots.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={round32FileInputRef}
          type="file"
          accept=".csv,text/csv,.txt"
          onChange={handleRound32CsvFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => round32FileInputRef.current?.click()}
          className="inline-flex items-center rounded border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-100"
        >
          <FaUpload className="mr-2" />Upload Round of 32 CSV
        </button>
        <button
          type="button"
          disabled={round32ImportDisabled}
          onClick={handleImportRound32}
          className="inline-flex items-center rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FaSave className="mr-2" />{round32UpdateLabel}
        </button>
        {round32CsvFileName ? <span className="text-sm text-emerald-900">{round32CsvFileName}</span> : null}
      </div>
      <textarea
        value={round32ImportText}
        onChange={(event) => setRound32ImportText(event.target.value)}
        rows={10}
        className="mt-4 w-full rounded border border-emerald-300 bg-white p-3 font-mono text-xs"
        placeholder={'slot,name,seed,countryCode,entryStatus\n1,Player One,1,ESP,\n2,Player Two,,USA,Q\n...\n32,Player Thirty Two,,GBR,'}
      />
      <label className="mt-3 block text-sm font-semibold text-emerald-950">Audit reason</label>
      <input value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded border border-emerald-300 bg-white px-3 py-2" placeholder="Imported final 32 field" />
      <button
        type="button"
        disabled={round32ImportDisabled}
        onClick={handleImportRound32}
        className="mt-4 inline-flex items-center rounded bg-emerald-700 px-4 py-2 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
      >
        <FaFileImport className="mr-2" />{round32UpdateLabel}
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => navigate(`/league/${leagueId}?view=admin`)}
        className="inline-flex items-center rounded bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
      >
        <FaArrowLeft className="mr-2" />Back to Admin
      </button>
      <div className="flex flex-wrap gap-2">
        {[['draw', 'Draw Import'], ['round32', 'Import 32'], ['results', 'Official Results'], ['scoring', 'Scoring']].map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`rounded px-4 py-2 text-sm font-semibold transition ${tab === key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'}`}>{label}</button>
        ))}
      </div>
      {feedback ? <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{feedback}</div> : null}
      {error ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

      {tab === 'draw' ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <h2 className="flex items-center text-lg font-bold text-blue-900"><FaBolt className="mr-2 text-blue-600" />Quick Fill</h2>
            <p className="mt-2 text-sm text-blue-800">Populate every draw slot with the bundled 128-player active men's fixture. This replaces the current entrants.</p>
            <button
              type="button"
              disabled={fillingDraw}
              onClick={handleFillActiveMen}
              className="mt-4 inline-flex items-center rounded bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
            >
              <FaBolt className="mr-2" />{fillingDraw ? 'Filling Draw…' : 'Fill All 128 Slots'}
            </button>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-5 shadow-sm">
            <h2 className="flex items-center text-lg font-bold text-red-900"><FaExclamationTriangle className="mr-2 text-red-600" />Reset to Round of 32</h2>
            <p className="mt-2 text-sm text-red-800">Clears every participant pick and official result, reopens the bracket, and makes Round of 32 the first playable round.</p>
            <label className="mt-4 block text-sm font-semibold text-red-950">Audit reason</label>
            <input value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded border border-red-300 bg-white px-3 py-2" placeholder="Reset live bracket to Round of 32" />
            <button
              type="button"
              disabled={trimmingDraw}
              onClick={handleTrimToRoundOf32}
              className="mt-4 inline-flex items-center rounded bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
            >
              <FaExclamationTriangle className="mr-2" />{trimmingDraw ? 'Resetting…' : 'Reset League to Round of 32'}
            </button>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-md">
            <h2 className="flex items-center text-lg font-bold text-gray-900"><FaFileImport className="mr-2 text-indigo-600" />Manual Draw Import</h2>
            <p className="mt-2 text-sm text-gray-600">Paste JSON or CSV. CSV columns: <code>slot,name,seed,countryCode,entryStatus,externalId</code>. Picks follow the permanent slot when the entrant changes.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,.txt"
                onChange={handleCsvFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center rounded border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100"
              >
                <FaUpload className="mr-2" />Upload CSV
              </button>
              {csvFileName ? <span className="text-sm text-gray-600">{csvFileName}</span> : null}
            </div>
            <textarea value={importText} onChange={(event) => setImportText(event.target.value)} rows={14} className="mt-4 w-full rounded border border-gray-300 p-3 font-mono text-xs" placeholder={'slot,name,seed,countryCode,entryStatus\n1,Player One,1,ESP,\n2,Player Two,,USA,Q'} />
            <label className="mt-3 block text-sm font-semibold text-gray-700">Audit note</label>
            <input value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" placeholder="Optional" />
            <button onClick={handleImport} className="mt-4 inline-flex items-center rounded bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700"><FaFileImport className="mr-2" />Import Draw</button>
          </div>
        </div>
      ) : null}

      {tab === 'round32' ? (
        <div className="space-y-4">
          {round32ImportPanel}
        </div>
      ) : null}

      {tab === 'results' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <label className="block text-sm font-semibold text-amber-950">Audit note</label>
            <input value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 w-full rounded border border-amber-300 bg-white px-3 py-2" placeholder="Optional" />
          </div>
          <DrawBracket
            gameData={bundle.gameData}
            picksByMatchId={results}
            officialResultsByMatchId={results}
            editable={true}
            showResults={false}
            setPredictionEnabled={Boolean(scoring.setPredictionEnabled)}
            allowCompletionReason={true}
            onChange={setResults}
          />
          <button onClick={handleSaveResults} className="inline-flex items-center rounded bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700"><FaTrophy className="mr-2" />Save Official Results</button>
        </div>
      ) : null}

      {tab === 'scoring' ? (
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-md">
          <h2 className="text-lg font-bold text-gray-900">Scoring and Tie-breakers</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(scoring.roundPoints || {}).map(([roundKey, points]) => (
              <label key={roundKey} className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{roundKey.replace(/([A-Z])/g, ' $1')}</span>
                <input type="number" min="0" value={points} onChange={(event) => setScoring((current) => ({ ...current, roundPoints: { ...current.roundPoints, [roundKey]: Number(event.target.value) } }))} className="w-full rounded border border-gray-300 px-3 py-2" />
              </label>
            ))}
          </div>
          <label className="mt-5 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <input type="checkbox" checked={Boolean(scoring.setPredictionEnabled)} onChange={(event) => setScoring((current) => ({ ...current, setPredictionEnabled: event.target.checked }))} />
            Enable optional set predictions as a standings tie-breaker
          </label>
          <button onClick={handleSaveScoring} className="mt-5 inline-flex items-center rounded bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700"><FaSave className="mr-2" />Save Scoring</button>
        </div>
      ) : null}
    </div>
  );
};

export default AdminSettings;
