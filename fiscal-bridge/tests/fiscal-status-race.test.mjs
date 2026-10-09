
import test from "node:test";
import assert from "node:assert/strict";

import {
  FiscalService,
} from "../src/fiscal-service.mjs";

function controlledDriver() {
  let resolveStatus;
  let signalRead;

  let disconnects = 0;

  const readEntered = new Promise(
    resolve => {
      signalRead = resolve;
    }
  );

  const statusPending = new Promise(
    resolve => {
      resolveStatus = resolve;
    }
  );

  const driver = {
    async connect() {
      return {
        connected: true,
        simulated: true,
      };
    },

    async getStatus() {
      signalRead();
      return statusPending;
    },

    async disconnect() {
      disconnects++;

      return {
        connected: false,
      };
    },
  };

  return {
    service: new FiscalService({
      create() {
        return driver;
      },
    }),

    resolveStatus,
    readEntered,

    getDisconnects() {
      return disconnects;
    },
  };
}

test(
  "Status query blocks concurrent disconnect",
  async () => {
    const {
      service,
      resolveStatus,
      readEntered,
      getDisconnects,
    } = controlledDriver();

    await service.connect("mock");

    const status = service.getStatus();

    await readEntered;

    await assert.rejects(
      service.disconnect(),
      { code: "SERVICE_BUSY" }
    );

    await assert.rejects(
      service.getStatus(),
      { code: "SERVICE_BUSY" }
    );

    assert.equal(getDisconnects(), 0);

    resolveStatus({
      connected: true,
      simulated: true,
    });

    const result = await status;

    assert.equal(result.connected, true);

    await service.disconnect();

    assert.equal(getDisconnects(), 1);
  }
);

test(
  "Failed status query releases lock",
  async () => {
    let rejectStatus;
    let signalRead;

    const readEntered = new Promise(
      resolve => {
        signalRead = resolve;
      }
    );

    const statusPending = new Promise(
      (_resolve, reject) => {
        rejectStatus = reject;
      }
    );

    const driver = {
      async connect() {
        return {
          connected: true,
          simulated: true,
        };
      },

      async getStatus() {
        signalRead();
        return statusPending;
      },

      async disconnect() {
        return {
          connected: false,
        };
      },
    };

    const service = new FiscalService({
      create() {
        return driver;
      },
    });

    await service.connect("mock");

    const status = service.getStatus();

    await readEntered;

    rejectStatus(
      new Error("SENSOR_ERROR")
    );

    await assert.rejects(
      status,
      /SENSOR_ERROR/
    );

    const disconnected =
      await service.disconnect();

    assert.equal(
      disconnected.connected,
      false
    );
  }
);
