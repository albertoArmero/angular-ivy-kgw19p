"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlurryRecognitionPreloader = void 0;
var tslib_1 = require("tslib");
var eventemitter3_1 = require("eventemitter3");
var __1 = require("..");
var barcode_1 = require("./barcode");
var browserHelper_1 = require("./browserHelper");
var engineLoader_1 = require("./engineLoader");
var engineWorker_1 = require("./workers/engineWorker");
var BlurryRecognitionPreloaderEventEmitter = /** @class */ (function (_super) {
    tslib_1.__extends(BlurryRecognitionPreloaderEventEmitter, _super);
    function BlurryRecognitionPreloaderEventEmitter() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return BlurryRecognitionPreloaderEventEmitter;
}(eventemitter3_1.EventEmitter));
var BlurryRecognitionPreloader = /** @class */ (function () {
    function BlurryRecognitionPreloader(preload) {
        this.eventEmitter = new eventemitter3_1.EventEmitter();
        this.queuedBlurryRecognitionSymbologies = Array.from(BlurryRecognitionPreloader.availableBlurryRecognitionSymbologies.values());
        this.readyBlurryRecognitionSymbologies = new Set();
        this.preload = preload;
    }
    BlurryRecognitionPreloader.create = function (preload) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var browserName, worker_1;
            return tslib_1.__generator(this, function (_a) {
                if (preload) {
                    browserName = browserHelper_1.BrowserHelper.userAgentInfo.getBrowser().name;
                    if (browserName != null && browserName.includes("Edge")) {
                        worker_1 = new Worker(URL.createObjectURL(new Blob(["(" + BlurryRecognitionPreloader.workerIndexedDBSupportTestFunction.toString() + ")()"], {
                            type: "text/javascript",
                        })));
                        return [2 /*return*/, new Promise(function (resolve) {
                                worker_1.onmessage = function (message) {
                                    worker_1.terminate();
                                    resolve(new BlurryRecognitionPreloader(message.data));
                                };
                            })];
                    }
                }
                return [2 /*return*/, new BlurryRecognitionPreloader(preload)];
            });
        });
    };
    // istanbul ignore next
    BlurryRecognitionPreloader.workerIndexedDBSupportTestFunction = function () {
        try {
            indexedDB.deleteDatabase("scandit_indexeddb_support_test");
            // @ts-ignore
            postMessage(true);
        }
        catch (error) {
            // @ts-ignore
            postMessage(false);
        }
    };
    BlurryRecognitionPreloader.prototype.prepareBlurryTables = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var alreadyAvailable, error_1;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        alreadyAvailable = true;
                        if (!this.preload) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.checkBlurryTablesAlreadyAvailable()];
                    case 2:
                        alreadyAvailable = _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        // istanbul ignore next
                        console.error(error_1);
                        return [3 /*break*/, 4];
                    case 4:
                        if (alreadyAvailable) {
                            this.queuedBlurryRecognitionSymbologies = [];
                            this.readyBlurryRecognitionSymbologies = new Set(BlurryRecognitionPreloader.availableBlurryRecognitionSymbologies);
                            this.eventEmitter.emit("blurryTablesUpdate", new Set(this.readyBlurryRecognitionSymbologies));
                        }
                        else {
                            this.engineWorker = new Worker(URL.createObjectURL(engineWorker_1.engineWorkerBlob));
                            this.engineWorker.onmessage = this.engineWorkerOnMessage.bind(this);
                            engineLoader_1.EngineLoader.load(this.engineWorker, true, true);
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    BlurryRecognitionPreloader.prototype.on = function (eventName, listener) {
        // istanbul ignore else
        if (eventName === "blurryTablesUpdate") {
            if (this.readyBlurryRecognitionSymbologies.size ===
                BlurryRecognitionPreloader.availableBlurryRecognitionSymbologies.size) {
                listener(this.readyBlurryRecognitionSymbologies);
            }
            else {
                this.eventEmitter.on(eventName, listener);
            }
        }
    };
    BlurryRecognitionPreloader.prototype.updateBlurryRecognitionPriority = function (scanSettings) {
        var newQueuedBlurryRecognitionSymbologies = this.queuedBlurryRecognitionSymbologies.slice();
        this.getEnabledSymbologies(scanSettings).forEach(function (symbology) {
            var symbologyQueuePosition = newQueuedBlurryRecognitionSymbologies.indexOf(symbology);
            if (symbologyQueuePosition !== -1) {
                newQueuedBlurryRecognitionSymbologies.unshift(newQueuedBlurryRecognitionSymbologies.splice(symbologyQueuePosition, 1)[0]);
            }
        });
        this.queuedBlurryRecognitionSymbologies = newQueuedBlurryRecognitionSymbologies;
    };
    BlurryRecognitionPreloader.prototype.isBlurryRecognitionAvailable = function (scanSettings) {
        var _this = this;
        var enabledBlurryRecognitionSymbologies = this.getEnabledSymbologies(scanSettings);
        return enabledBlurryRecognitionSymbologies.every(function (symbology) {
            return _this.readyBlurryRecognitionSymbologies.has(symbology);
        });
    };
    BlurryRecognitionPreloader.prototype.getEnabledSymbologies = function (scanSettings) {
        return Array.from(BlurryRecognitionPreloader.availableBlurryRecognitionSymbologies.values()).filter(function (symbology) {
            return scanSettings.isSymbologyEnabled(symbology);
        });
    };
    BlurryRecognitionPreloader.prototype.createNextBlurryTableSymbology = function () {
        var symbology;
        do {
            symbology = this.queuedBlurryRecognitionSymbologies.shift();
        } while (symbology != null && this.readyBlurryRecognitionSymbologies.has(symbology));
        // istanbul ignore else
        if (symbology != null) {
            this.engineWorker.postMessage({
                type: "create-blurry-table",
                symbology: symbology,
            });
        }
    };
    BlurryRecognitionPreloader.prototype.checkBlurryTablesAlreadyAvailable = function () {
        return new Promise(function (resolve) {
            var openDbRequest = indexedDB.open(BlurryRecognitionPreloader.writableDataPath);
            function handleErrorOrNew() {
                var _a;
                (_a = openDbRequest === null || openDbRequest === void 0 ? void 0 : openDbRequest.result) === null || _a === void 0 ? void 0 : _a.close();
                // this.error
                resolve(false);
            }
            openDbRequest.onupgradeneeded = function () {
                try {
                    openDbRequest.result.createObjectStore(BlurryRecognitionPreloader.fsObjectStoreName);
                }
                catch (error) {
                    // Ignored
                }
            };
            openDbRequest.onsuccess = function () {
                try {
                    var transaction = openDbRequest.result.transaction(BlurryRecognitionPreloader.fsObjectStoreName, "readonly");
                    transaction.onerror = handleErrorOrNew;
                    var storeKeysRequest_1 = transaction
                        .objectStore(BlurryRecognitionPreloader.fsObjectStoreName)
                        .getAllKeys();
                    storeKeysRequest_1.onsuccess = function () {
                        openDbRequest.result.close();
                        if ((__1.highEndBlurryRecognition
                            ? BlurryRecognitionPreloader.highEndBlurryTableFiles
                            : BlurryRecognitionPreloader.defaultBlurryTableFiles).every(function (file) {
                            return storeKeysRequest_1.result.indexOf(file) !== -1;
                        })) {
                            return resolve(true);
                        }
                        else {
                            return resolve(false);
                        }
                    };
                    storeKeysRequest_1.onerror = handleErrorOrNew;
                }
                catch (error) {
                    handleErrorOrNew.call({ error: error });
                }
            };
            openDbRequest.onblocked = openDbRequest.onerror = handleErrorOrNew;
        });
    };
    BlurryRecognitionPreloader.prototype.engineWorkerOnMessage = function (ev) {
        var _this = this;
        var data = ev.data;
        // istanbul ignore else
        if (data[1] != null) {
            switch (data[0]) {
                case "context-created":
                    this.createNextBlurryTableSymbology();
                    break;
                case "create-blurry-table-result":
                    this.readyBlurryRecognitionSymbologies.add(data[1]);
                    if ([barcode_1.Barcode.Symbology.EAN8, barcode_1.Barcode.Symbology.EAN13, barcode_1.Barcode.Symbology.UPCA, barcode_1.Barcode.Symbology.UPCE].includes(data[1])) {
                        this.readyBlurryRecognitionSymbologies.add(barcode_1.Barcode.Symbology.EAN13);
                        this.readyBlurryRecognitionSymbologies.add(barcode_1.Barcode.Symbology.EAN8);
                        this.readyBlurryRecognitionSymbologies.add(barcode_1.Barcode.Symbology.UPCA);
                        this.readyBlurryRecognitionSymbologies.add(barcode_1.Barcode.Symbology.UPCE);
                    }
                    else if ([barcode_1.Barcode.Symbology.CODE32, barcode_1.Barcode.Symbology.CODE39].includes(data[1])) {
                        this.readyBlurryRecognitionSymbologies.add(barcode_1.Barcode.Symbology.CODE32);
                        this.readyBlurryRecognitionSymbologies.add(barcode_1.Barcode.Symbology.CODE39);
                    }
                    this.eventEmitter.emit("blurryTablesUpdate", new Set(this.readyBlurryRecognitionSymbologies));
                    if (this.readyBlurryRecognitionSymbologies.size ===
                        BlurryRecognitionPreloader.availableBlurryRecognitionSymbologies.size) {
                        // Avoid data not being persisted if IndexedDB operations in WebWorker are slow
                        setTimeout(function () {
                            _this.engineWorker.terminate();
                        }, 250);
                    }
                    else {
                        this.createNextBlurryTableSymbology();
                    }
                    break;
                // istanbul ignore next
                default:
                    break;
            }
        }
    };
    BlurryRecognitionPreloader.writableDataPath = "/scandit_sync_folder_preload";
    BlurryRecognitionPreloader.fsObjectStoreName = "FILE_DATA";
    // From AndroidLowEnd
    BlurryRecognitionPreloader.defaultBlurryTableFiles = [
        "/1a3f08f42d1332344e3cebb5c53d9837.scandit",
        "/9590b4b7b91d4a5ed250c07e3e6d817c.scandit",
        "/d5739c566e6804f3870e552f90e3afd6.scandit",
        "/131e51bb75340269aa65fd0e79092b88.scandit",
        "/6e1a9119f3e7960affc7ec57d5444ee7.scandit",
        "/d6fc3b403665c15391a34f142ee5a59a.scandit",
        "/37a5f5595921dc70b8521b51213a0530.scandit",
        "/b880ff697b6227d550661fe5f3ab15c7.scandit",
        "/cfc864aadea0fae1260143f5316ae73e.scandit",
        "/53a170d0b32f167b80e54af43528083e.scandit",
        "/9f8ad6910aa4c274c083477d55d3118a.scandit",
        "/e9bcde4da8bc210db7ea508a8533c6c0.scandit",
        "/4507cf80990b8ecd64d3f9f4898c93d0.scandit",
        "/76ca9155b19b81b4ea4a209c9c2154a4.scandit",
        "/9da3d4277f729835f5a1b00f8222de44.scandit",
        "/3c977e4745212da13b988db64d793b01.scandit",
        "/b04cd3b79ca8a4972422d95b71c4a33f.scandit",
        "/deaa2ce67c6953bdeef1fb9bcdd91d3f.scandit", // msi-plessey
    ].map(function (path) {
        return "" + BlurryRecognitionPreloader.writableDataPath + path;
    });
    // From AndroidGeneric
    BlurryRecognitionPreloader.highEndBlurryTableFiles = [
        "/0748cc6fee4d78784c17ec2c4fbac82a.scandit",
        "/8ddc2819197df8dbbe44c50f647737fc.scandit",
        "/d549d071f736712b6ff08ed7b1e18fd9.scandit",
        "/ebf4d7eb2bee4e0c382bfb9d01624386.scandit",
        "/f2c85c7a23d2eb86735f2cd28ddd6697.scandit",
        "/f59dbe839f43cf8ad315f4dee79eadfe.scandit",
        "/2a69cd12c6e7aa1e4a158c29387fac76.scandit",
        "/4bd72afadf36c13c58b16b82af51ef5b.scandit",
        "/6e24282c52fe43d231931e81d4003963.scandit",
        "/cce10e5c3a0f08b25a9beb90dbfde974.scandit",
        "/de441e7fae8990428b392c4d5ad4dfd7.scandit",
        "/f76ea1b97ebcd39becd0eb0202a7cf08.scandit",
        "/073e2bcc5bf0bb3052347ac8c45c642f.scandit",
        "/0e427c35dd235caaa9721e35603e5fff.scandit",
        "/5c13109d1321892b47b6ad725bc50ed0.scandit",
        "/6ad5f7cc3a353d2814afddf407846829.scandit",
        "/7f13d20c5936a79778856f229ebaaf86.scandit",
        "/bbed8297760fa214ffbd5d614d3daddd.scandit",
        "/0135b00baa466a6592ae7b76d0a2de2d.scandit",
        "/3942a543bde6665c09fcbe480ff2c049.scandit",
        "/9815db0951fc4fb4b917659c2c6fd5d2.scandit",
        "/b0ef84087d9d014fc0312f28b548f65e.scandit",
        "/d966c1c9bffe321a850a92d4064162dd.scandit",
        "/f64d15054f845bae2b3d14facc31e4ad.scandit",
        "/1b83ed2da3602de8395020daab46e06b.scandit",
        "/28dfe4fd7754d0914c75a95970356e29.scandit",
        "/582127197f98a68999745031cd725fcc.scandit",
        "/5dab481cf36d00a521d57b20aa329174.scandit",
        "/a1b3a4de408ae6de1e3fbd36e8c61139.scandit",
        "/b096d28ef81e0ad06bae97abdbefb576.scandit",
        "/49903d3aa45ad02e51c4b69d493f37b4.scandit",
        "/5c4bc98fe1f96f522bbe2298acc6f352.scandit",
        "/5c99f397e023dceaa1cdcd250b71cec2.scandit",
        "/9d0d2edff8553a9f87b158b418ce7bc9.scandit",
        "/bb426db5dc2d9a2dc56993802fc5677b.scandit",
        "/c55f68dcf3478beaa0ad9243fc7c43eb.scandit", // msi-plessey
    ].map(function (path) {
        return "" + BlurryRecognitionPreloader.writableDataPath + path;
    });
    // Roughly ordered by priority
    BlurryRecognitionPreloader.availableBlurryRecognitionSymbologies = new Set([
        barcode_1.Barcode.Symbology.EAN13,
        barcode_1.Barcode.Symbology.EAN8,
        barcode_1.Barcode.Symbology.CODE32,
        barcode_1.Barcode.Symbology.CODE39,
        barcode_1.Barcode.Symbology.CODE128,
        barcode_1.Barcode.Symbology.CODE93,
        barcode_1.Barcode.Symbology.INTERLEAVED_2_OF_5,
        barcode_1.Barcode.Symbology.MSI_PLESSEY,
        barcode_1.Barcode.Symbology.UPCA,
        barcode_1.Barcode.Symbology.UPCE, // Shared with EAN8, EAN13, UPCA
    ]);
    return BlurryRecognitionPreloader;
}());
exports.BlurryRecognitionPreloader = BlurryRecognitionPreloader;
//# sourceMappingURL=blurryRecognitionPreloader.js.map