interface AsyncRequestQueueItem {
  abort: () => void;
  task: () => void;
}

type QueueFunction<T> = (signal: AbortSignal) => Promise<T>;

/**
 * Asynchronous sequential queue. Each task in the queue has an id
 * and tasks can be aborted by id.
 */
export default class AsyncRequestQueue {
  running = false;
  queue = new Map<number, AsyncRequestQueueItem>();

  /**
   * Adds a new task to the queue
   * @param requestId id of the task
   * @param task async task function, with an AbortSignal as its only parameter
   * @returns A promise that resolves with the return value of the task function, or throws the error of the task function
   */
  push<T>(requestId: number, task: QueueFunction<T>): Promise<T> {
    if (this.queue.has(requestId)) {
      throw new Error(`Request id ${requestId} already in queue`);
    }

    return new Promise((resolve, reject) => {
      const controller = new AbortController();

      // Add callback to the queue
      this.queue.set(requestId, {
        abort: () => controller.abort(),
        task: () => {
          task(controller.signal)
            .then((result) => {
              resolve(result);
              this.#next();
            })
            .catch((error) => {
              reject(error);
              this.#next();
            });
        },
      });

      if (!this.running) {
        // If nothing is running, then start the engines!
        this.#next();
      }
    });
  }

  #shift() {
    const [firstEntry = null] = this.queue;
    if (firstEntry) {
      this.queue.delete(firstEntry[0]);
      return firstEntry[1];
    }
  }

  #next() {
    this.running = false;
    // Get the first element off the queue and execute it
    const nextItem = this.#shift();
    if (nextItem) {
      this.running = true;
      nextItem.task();
    }
  }

  /**
   * Signals the task with `requestId` to abort
   * @param requestId id of the task
   */
  abort(requestId: number) {
    this.queue.get(requestId)?.abort();
  }

  /**
   * Checks the existence of a specific task
   * @param requestId id of the task
   * @returns Wether a task with id `requestId` is in the queue.
   */
  has(requestId: number) {
    return this.queue.has(requestId);
  }

  /**
   * Clears the queue (running task will not be aborted)
   */
  clear() {
    this.queue.clear();
  }
}
