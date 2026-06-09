// Type for Vite's `?worker&inline` import: the default export is a Worker
// constructor backed by an inlined Blob (no external file, no URL to resolve in
// downstream consumers — see worker-transport-design §8 / playout-v3-design §11.9).
declare module '*?worker&inline' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}
