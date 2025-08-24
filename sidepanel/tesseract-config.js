// Tesseract worker configuration
const TESSERACT_WORKER = chrome.runtime.getURL("../ocr/worker.min.js");
Tesseract.createWorker = ((orig) => async (opts={}) => {
  opts.workerPath = opts.workerPath || TESSERACT_WORKER;
  return orig(opts);
})(Tesseract.createWorker);