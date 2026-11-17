// Shared TypeScript types for the UI engine (crm-engine.ts) and the sync adapter (sync.ts).
//
// The engine was ported from a loosely typed prototype, so its business records (properties, leads, deals …) are
// described as open "records": the columns we rely on are named below, and any other column is still allowed.
// Naming the main shapes here is what lets the TypeScript compiler (and VS Code) check the engine instead of ignoring it.

/** An open record: a business row such as a property, lead or deal. New columns may be added without touching this file. */
export type Rec = Record<string, any>;

/** A row that always has a primary key (`id`; brokerage rows use `deal`). */
export interface Row extends Rec {
  id?: string;
}

/** One entry of the role/permission matrix: [label, [flag per role]]. */
export type PermRow = [string, number[]];

/** A modal dialog that is currently open (its `t` is the dialog kind; each kind adds its own extra fields). */
export interface ModalState extends Rec {
  t: string;
}

/**
 * THE application state: everything the UI shows lives in this one object.
 * The named members are the ones every screen relies on; `[key: string]: any` allows the many small per-screen flags
 * (open dropdowns, draft forms, scroll positions …) that the engine adds at run time.
 */
export interface EngineState {
  // ---- business collections (loaded from the API, saved back through /api/sync)
  amen: Rec[];          // amenity master list
  projects: Rec[];      // real-estate projects
  props: Rec[];         // property listings (inventory)
  leads: Rec[];         // enquiries that have not become customers yet
  prospects: Rec[];     // qualified customers
  reqs: Rec[];          // customer requirements used for matching
  visits: Rec[];        // scheduled site visits
  fus: Rec[];           // follow-up tasks
  deals: Rec[];         // deals in progress / closed
  brok: Rec[];          // brokerage (commission) records, keyed by deal
  team: Rec[];          // team members (users)
  roles: any[];         // role templates kept in the small-JSON store
  // ---- per-screen UI state
  f: Rec;               // list filters per screen
  q: Rec;               // search boxes per screen
  modal: ModalState | null; // the open dialog, if any
  toast: string;        // message shown in the toast bar ('' = none)
  nav: boolean;         // mobile side menu open?
  d: Rec;               // the draft record being edited in a form
  ctx: any;             // context of the open pop-up menu
  tab: Rec;             // active tab per screen
  am: Rec;              // amenity picker state
  // ---- permission matrix and masters (loaded from /api/bootstrap)
  mods?: any[];          // [moduleKey, label] pairs
  lv?: Rec;              // access level per module per role
  act?: any[];           // special permissions per role
  projectTypes?: string[];
  features?: string[];
  brokerGroups?: string[];
  sizeUnits?: string[];
  // ---- anything else the engine stores on the state (draft forms, flags, org profile, audit list …)
  [key: string]: any;
}

/** What `GET /api/bootstrap` returns: the collections above plus who is signed in and what they may do. */
export interface Boot extends Rec {
  me?: string;                                     // signed-in user's name
  profile?: { levels: Rec; actions: Rec; seeNumbers: boolean; role?: string };
  audit?: Rec[];                                   // recent activity (Team screen)
  files?: Rec;                                     // uploaded document records
}

/** The object the engine calls to talk to the server (created by sync.ts → createAdapter). */
export interface EngineAdapter {
  /** Give the adapter the engine's toast() and render() functions. */
  attach?: (hooks: { toast?: (t: string) => void; render?: () => void }) => void;
  /** Tell the adapter the first render is done so it can record the baseline snapshot. */
  loaded?: (S: EngineState) => void;
  /** Persist whatever changed since the last save. */
  save: (S: EngineState) => void;
  /** Upload a document file; resolves when the server has stored it. */
  upload?: (...args: any[]) => any;
  /** Open a stored document through the authenticated API. */
  openUrl?: (...args: any[]) => any;
  /** Send pending edits and wait until the server has them. */
  flushNow?: (S: EngineState) => Promise<void>;
  /** Sign out. */
  logout?: () => void;
  /** Direct API call (used by the Team and My account screens). */
  api?: (path: string, opts?: { method?: string; body?: any }) => Promise<any>;
}

/** A click action: receives the clicked element (and the event) and may change state, then re-render. */
export type ActHandler = (el?: any, ev?: any) => any;
