import { EventEmitter } from "eventemitter3";
import { highEndBlurryRecognition } from "..";
import { Barcode } from "./barcode";
import { BrowserHelper } from "./browserHelper";
import { EngineLoader } from "./engineLoader";
import { engineWorkerBlob } from "./workers/engineWorker";
class BlurryRecognitionPreloaderEventEmitter extends EventEmitter {
}
export class BlurryRecognitionPreloader {
    constructor(preload) {
        this.eventEmitter = new EventEmitter();
        this.queuedBlurryRecognitionSymbologies = Array.from(BlurryRecognitionPreloader.availableBlurryRecognitionSymbologies.values());
        this.readyBlurryRecognitionSymbologies = new Set();
        this.preload = preload;
    }
    static async create(preload) {
        if (preload) {
            // Edge <= 18 doesn't support IndexedDB in blob Web Workers so data wouldn't be persisted,
            // hence it would be useless to preload blurry recognition as data couldn't be saved.
            // Verify support for IndexedDB in blob Web Workers.
            const browserName = BrowserHelper.userAgentInfo.getBrowser().name;
            if (browserName != null && browserName.includes("Edge")) {
                const worker = new Worker(URL.createObjectURL(new Blob([`(${BlurryRecognitionPreloader.workerIndexedDBSupportTestFunction.toString()})()`], {
                    type: "text/javascript",
                })));
                return new Promise((resolve) => {
                    worker.onmessage = (message) => {
                        worker.terminate();
                        resolve(new BlurryRecognitionPreloader(message.data));
                    };
                });
            }
        }
        return new BlurryRecognitionPreloader(preload);
    }
    // istanbul ignore next
    static workerIndexedDBSupportTestFunction() {
        try {
            indexedDB.deleteDatabase("scandit_indexeddb_support_test");
            // @ts-ignore
            postMessage(true);
        }
        catch (error) {
            // @ts-ignore
            postMessage(false);
        }
    }
    async prepareBlurryTables() {
        let alreadyAvailable = true;
        if (this.preload) {
            try {
                alreadyAvailable = await this.checkBlurryTablesAlreadyAvailable();
            }
            catch (error) {
                // istanbul ignore next
                console.error(error);
            }
        }
        if (alreadyAvailable) {
            this.queuedBlurryRecognitionSymbologies = [];
            this.readyBlurryRecognitionSymbologies = new Set(BlurryRecognitionPreloader.availableBlurryRecognitionSymbologies);
            this.eventEmitter.emit("blurryTablesUpdate", new Set(this.readyBlurryRecognitionSymbologies));
        }
        else {
            this.engineWorker = new Worker(URL.createObjectURL(engineWorkerBlob));
            this.engineWorker.onmessage = this.engineWorkerOnMessage.bind(this);
            EngineLoader.load(this.engineWorker, true, true);
        }
    }
    on(eventName, listener) {
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
    }
    updateBlurryRecognitionPriority(scanSettings) {
        const newQueuedBlurryRecognitionSymbologies = this.queuedBlurryRecognitionSymbologies.slice();
        this.getEnabledSymbologies(scanSettings).forEach((symbology) => {
            const symbologyQueuePosition = newQueuedBlurryRecognitionSymbologies.indexOf(symbology);
            if (symbologyQueuePosition !== -1) {
                newQueuedBlurryRecognitionSymbologies.unshift(newQueuedBlurryRecognitionSymbologies.splice(symbologyQueuePosition, 1)[0]);
            }
        });
        this.queuedBlurryRecognitionSymbologies = newQueuedBlurryRecognitionSymbologies;
    }
    isBlurryRecognitionAvailable(scanSettings) {
        const enabledBlurryRecognitionSymbologies = this.getEnabledSymbologies(scanSettings);
        return enabledBlurryRecognitionSymbologies.every((symbology) => {
            return this.readyBlurryRecognitionSymbologies.has(symbology);
        });
    }
    getEnabledSymbologies(scanSettings) {
        return Array.from(BlurryRecognitionPreloader.availableBlurryRecognitionSymbologies.values()).filter((symbology) => {
            return scanSettings.isSymbologyEnabled(symbology);
        });
    }
    createNextBlurryTableSymbology() {
        let symbology;
        do {
            symbology = this.queuedBlurryRecognitionSymbologies.shift();
        } while (symbology != null && this.readyBlurryRecognitionSymbologies.has(symbology));
        // istanbul ignore else
        if (symbology != null) {
            this.engineWorker.postMessage({
                type: "create-blurry-table",
                symbology,
            });
        }
    }
    checkBlurryTablesAlreadyAvailable() {
        return new Promise((resolve) => {
            const openDbRequest = indexedDB.open(BlurryRecognitionPreloader.writableDataPath);
            function handleErrorOrNew() {
                openDbRequest?.result?.close();
                // this.error
                resolve(false);
            }
            openDbRequest.onupgradeneeded = () => {
                try {
                    openDbRequest.result.createObjectStore(BlurryRecognitionPreloader.fsObjectStoreName);
                }
                catch (error) {
                    // Ignored
                }
            };
            openDbRequest.onsuccess = () => {
                try {
                    const transaction = openDbRequest.result.transaction(BlurryRecognitionPreloader.fsObjectStoreName, "readonly");
                    transaction.onerror = handleErrorOrNew;
                    const storeKeysRequest = transaction
                        .objectStore(BlurryRecognitionPreloader.fsObjectStoreName)
                        .getAllKeys();
                    storeKeysRequest.onsuccess = () => {
                        openDbRequest.result.close();
                        if ((highEndBlurryRecognition
                            ? BlurryRecognitionPreloader.highEndBlurryTableFiles
                            : BlurryRecognitionPreloader.defaultBlurryTableFiles).every((file) => {
                            return storeKeysRequest.result.indexOf(file) !== -1;
                        })) {
                            return resolve(true);
                        }
                        else {
                            return resolve(false);
                        }
                    };
                    storeKeysRequest.onerror = handleErrorOrNew;
                }
                catch (error) {
                    handleErrorOrNew.call({ error });
                }
            };
            openDbRequest.onblocked = openDbRequest.onerror = handleErrorOrNew;
        });
    }
    engineWorkerOnMessage(ev) {
        const data = ev.data;
        // istanbul ignore else
        if (data[1] != null) {
            switch (data[0]) {
                case "context-created":
                    this.createNextBlurryTableSymbology();
                    break;
                case "create-blurry-table-result":
                    this.readyBlurryRecognitionSymbologies.add(data[1]);
                    if ([Barcode.Symbology.EAN8, Barcode.Symbology.EAN13, Barcode.Symbology.UPCA, Barcode.Symbology.UPCE].includes(data[1])) {
                        this.readyBlurryRecognitionSymbologies.add(Barcode.Symbology.EAN13);
                        this.readyBlurryRecognitionSymbologies.add(Barcode.Symbology.EAN8);
                        this.readyBlurryRecognitionSymbologies.add(Barcode.Symbology.UPCA);
                        this.readyBlurryRecognitionSymbologies.add(Barcode.Symbology.UPCE);
                    }
                    else if ([Barcode.Symbology.CODE32, Barcode.Symbology.CODE39].includes(data[1])) {
                        this.readyBlurryRecognitionSymbologies.add(Barcode.Symbology.CODE32);
                        this.readyBlurryRecognitionSymbologies.add(Barcode.Symbology.CODE39);
                    }
                    this.eventEmitter.emit("blurryTablesUpdate", new Set(this.readyBlurryRecognitionSymbologies));
                    if (this.readyBlurryRecognitionSymbologies.size ===
                        BlurryRecognitionPreloader.availableBlurryRecognitionSymbologies.size) {
                        // Avoid data not being persisted if IndexedDB operations in WebWorker are slow
                        setTimeout(() => {
                            this.engineWorker.terminate();
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
    }
}
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
].map((path) => {
    return `${BlurryRecognitionPreloader.writableDataPath}${path}`;
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
].map((path) => {
    return `${BlurryRecognitionPreloader.writableDataPath}${path}`;
});
// Roughly ordered by priority
BlurryRecognitionPreloader.availableBlurryRecognitionSymbologies = new Set([
    Barcode.Symbology.EAN13,
    Barcode.Symbology.EAN8,
    Barcode.Symbology.CODE32,
    Barcode.Symbology.CODE39,
    Barcode.Symbology.CODE128,
    Barcode.Symbology.CODE93,
    Barcode.Symbology.INTERLEAVED_2_OF_5,
    Barcode.Symbology.MSI_PLESSEY,
    Barcode.Symbology.UPCA,
    Barcode.Symbology.UPCE, // Shared with EAN8, EAN13, UPCA
]);
//# sourceMappingURL=blurryRecognitionPreloader.js.map