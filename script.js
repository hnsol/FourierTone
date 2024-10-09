class FourierToneAnalyzer {

    constructor() {
        this.startButton = document.getElementById('startRecording');
        this.inputCanvas = document.getElementById('inputStrengthCanvas');
        this.inputCanvasContext = this.inputCanvas.getContext('2d');
        this.frequencyCanvas = document.getElementById('frequencyCanvas');
        this.frequencyCanvasContext = this.frequencyCanvas.getContext('2d');
        this.recordingEndTimeDiv = document.getElementById('recordingEndTime');
        this.dbValuesDiv = document.getElementById('dbValues'); // minDbとmaxDbを表示する要素

        this.buttonConfigurations = [
            { minDb: -100, maxDb: -35 },
            { minDb: -110, maxDb: -40 },
            { minDb: -120, maxDb: -45 },
            { minDb: -130, maxDb: -50 },
            { minDb: -140, maxDb: -55 }
        ];

        // 初期化: 最初のボタンのminDbとmaxDbを設定
        this.minDb = this.buttonConfigurations[0].minDb;
        this.maxDb = this.buttonConfigurations[0].maxDb;
        this.highlightActiveButton(0);

        this.octaveDisplayFlags = {
            'O0': false, 'O1': true, 'O2': true, 'O3': false, 'O4': true,
            'O5': true,  'O6': true, 'O7': false, 'O8': false, 'O9': false,
            'OALL': false
        }; // 各オクターブの表示フラグをディクショナリ形式で設定

        this.notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        this.octaves = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
        this.noteColors = {
            'C': '#E57373', 'C#': '#FF8A65', 'D': '#FFB74D', 'D#': '#FFD54F',
            'E': '#FFF176', 'F': '#AED581', 'F#': '#81C784', 'G': '#4DD0E1',
            'G#': '#4FC3F7', 'A': '#7986CB', 'A#': '#BA68C8', 'B': '#F06292'
        };

        this.frequenciesEqualTemperament = this.calculateFrequenciesEqualTemperament();
        this.frequenciesChakraTuning = this.calculateFrequenciesChakraTuning();
        this.currentFrequencies = this.frequenciesChakraTuning; // 初期状態ではチャクラ音律を使用

        this.recordingDuration = 10; // 録音時間を10秒に設定
//        this.recordingDuration = 3; // 録音時間を10秒に設定
        this.isRecording = false; // 録音中かどうかを管理するフラグ
        this.init();
    }

    init() {
        this.startButton.addEventListener('click', () => this.startRecording());

        // 5つのボタン（A-E）を設定
        for (let i = 0; i < 5; i++) {
            const button = document.getElementById(`button${String.fromCharCode(65 + i)}`);
            button.addEventListener('click', () => {
                this.setDbRange(i);
                this.highlightActiveButton(i);
            });
        }

        // 新しいボタン F の設定: frequencies を切り替える
        document.getElementById('buttonF').addEventListener('click', () => {
            this.toggleFrequencies();
        });

        // 最初にminDbとmaxDbを表示
        this.updateDbDisplay();

        this.resizeCanvases();
        this.drawAxisLabels();
    }

    highlightActiveButton(activeIndex) {
        for (let i = 0; i < 5; i++) {
            const button = document.getElementById(`button${String.fromCharCode(65 + i)}`);
            if (i === activeIndex) {
                button.style.backgroundColor = '#a9a9a9'; // アクティブなボタンの色（デフォルトより少し濃いグレー）
                button.style.color = 'white';
            } else {
                button.style.backgroundColor = '';
                button.style.color = '';
            }
        }
    }
    
    drawAxisLabels() {
        const rows = 12;
        const visibleOctaves = Object.keys(this.octaveDisplayFlags).filter(key => this.octaveDisplayFlags[key]).length; // OALLも含む
        const barWidth = (this.frequencyCanvas.width - 60) / visibleOctaves; // OALLも含めた表示オクターブ分の幅
    
        this.frequencyCanvasContext.font = '14px Noto Sans JP';
        this.frequencyCanvasContext.fillStyle = '#595959';
        this.frequencyCanvasContext.textBaseline = 'middle';
    
        // 縦軸ラベル（音階）を表示（上が高音、下が低音にするため、配列の順序を逆に）
        const barHeightUnit = (this.frequencyCanvas.height - 40) / rows;
        for (let row = 0; row < rows; row++) {
            this.frequencyCanvasContext.fillText(
                this.notes[11 - row],  // 音階の表示順序を逆にする
                10,
                row * barHeightUnit + barHeightUnit / 2 + 20
            );
        }
    
        // 横軸ラベル（オクターブ）を左詰めで表示
        this.frequencyCanvasContext.font = '10px Noto Sans JP';
        this.frequencyCanvasContext.textAlign = 'center';
    
        let colIndex = 0; // 有効なオクターブの列番号（左詰め）
    
        // OALLのラベル表示
        if (this.octaveDisplayFlags['OALL']) {
            this.frequencyCanvasContext.fillText('OALL', barWidth / 2 + 40, this.frequencyCanvas.height - 10);
            colIndex++; // OALL列の次に進む
        }
    
        // 有効なオクターブのラベル表示
        for (let col = 0; col < this.octaves.length; col++) {
            const octaveKey = `O${9 - col}`; // O0, O1...のキー
            if (this.octaveDisplayFlags[octaveKey]) { // フラグが true のオクターブのみ表示
                this.frequencyCanvasContext.fillText(
                    `O${9 - col}`,
                    colIndex * barWidth + barWidth / 2 + 40,
                    this.frequencyCanvas.height - 10
                );
                colIndex++; // 左詰めで次のオクターブに進む
            }
        }
    }
    calculateFrequenciesEqualTemperament() {
        let frequencies = [];
        const frequencyData = [
            [16.35, 32.70, 65.41, 130.81, 261.63, 523.25, 1046.50, 2093.00, 4186.01, 8372.02],
            [17.32, 34.65, 69.30, 138.59, 277.18, 554.37, 1108.73, 2217.46, 4434.92, 8869.84],
            [18.35, 36.71, 73.42, 146.83, 293.66, 587.33, 1174.66, 2349.32, 4698.63, 9397.27],
            [19.45, 38.89, 77.78, 155.56, 311.13, 622.25, 1244.51, 2489.02, 4978.03, 9956.06],
            [20.60, 41.20, 82.41, 164.81, 329.63, 659.25, 1318.51, 2637.02, 5274.04, 10548.08],
            [21.83, 43.65, 87.31, 174.61, 349.23, 698.46, 1396.91, 2793.83, 5587.65, 11175.30],
            [23.12, 46.25, 92.50, 185.00, 369.99, 739.99, 1479.98, 2959.96, 5919.91, 11839.82],
            [24.50, 49.00, 98.00, 196.00, 392.00, 783.99, 1567.98, 3135.96, 6271.93, 12543.85],
            [25.96, 51.91, 103.83, 207.65, 415.30, 830.61, 1661.22, 3322.44, 6644.88, 13289.76],
            [27.50, 55.00, 110.00, 220.00, 440.00, 880.00, 1760.00, 3520.00, 7040.00, 14080.00],
            [29.14, 58.27, 116.54, 233.08, 466.16, 932.33, 1864.66, 3729.31, 7458.62, 14917.24],
            [30.87, 61.74, 123.47, 246.94, 493.88, 987.77, 1975.53, 3951.07, 7902.13, 15804.27]
        ];

        this.notes.forEach((note, noteIndex) => {
            this.octaves.forEach((octave, octaveIndex) => {
                const frequency = frequencyData[noteIndex][octaveIndex];
                frequencies.push({ note: note + octave, frequency: frequency, color: this.noteColors[note], baseNote: note });
            });
        });

        return frequencies;
    }

    calculateFrequenciesChakraTuning() {
        let frequencies = [];
        // Chakra tuning の frequency data をハードコードします（例）
        const frequencyData = [
            [12.375, 24.750, 49.500, 99.000, 198.000, 396.000, 792.000, 1584.000, 3168.000, 6336.000],
            [12.699, 25.398, 50.796, 101.591, 203.182, 406.364, 812.729, 1625.457, 3250.915, 6501.830],
            [13.031, 26.063, 52.125, 104.250, 208.500, 417.000, 834.000, 1668.000, 3336.000, 6672.000],
            [14.663, 29.327, 58.654, 117.307, 234.615, 469.229, 938.458, 1876.917, 3753.833, 7507.666],
            [16.500, 33.000, 66.000, 132.000, 264.000, 528.000, 1056.000, 2112.000, 4224.000, 8448.000],
            [19.969, 39.938, 79.875, 159.750, 319.500, 639.000, 1278.000, 2556.000, 5112.000, 10224.000],
            [21.504, 43.007, 86.014, 172.028, 344.056, 688.113, 1376.225, 2752.451, 5504.901, 11009.802],
            [23.156, 46.313, 92.625, 185.250, 370.500, 741.000, 1482.000, 2964.000, 5928.000, 11856.000],
            [24.830, 49.660, 99.321, 198.641, 397.282, 794.564, 1589.128, 3178.256, 6356.512, 12713.025],
            [26.625, 53.250, 106.500, 213.000, 426.000, 852.000, 1704.000, 3408.000, 6816.000, 13632.000],
            [28.306, 56.613, 113.225, 226.450, 452.901, 905.801, 1811.603, 3623.205, 7246.410, 14492.821],
            [30.094, 60.188, 120.375, 240.750, 481.500, 963.000, 1926.000, 3852.000, 7704.000, 15408.000]
        ];

        this.notes.forEach((note, noteIndex) => {
            this.octaves.forEach((octave, octaveIndex) => {
                const frequency = frequencyData[noteIndex][octaveIndex];
                frequencies.push({ note: note + octave, frequency: frequency, color: this.noteColors[note], baseNote: note });
            });
        });

        return frequencies;
    }

    toggleFrequencies() {
        if (this.currentFrequencies === this.frequenciesEqualTemperament) {
            this.currentFrequencies = this.frequenciesChakraTuning;
        } else {
            this.currentFrequencies = this.frequenciesEqualTemperament;
        }
        this.updateDbDisplay();
        this.drawAxisLabels();
        this.drawNoteStrengths(this.calculateNoteStrengths());
    }

    setDbRange(index) {
        const config = this.buttonConfigurations[index];
        this.minDb = config.minDb;
        this.maxDb = config.maxDb;

        // minDbとmaxDbを表示する
        this.updateDbDisplay();

        this.drawNoteStrengths(this.calculateNoteStrengths());
    }

    updateDbDisplay() {
        const tuningName = this.currentFrequencies === this.frequenciesEqualTemperament ? 'Equal' : 'Chakra';
        this.dbValuesDiv.textContent = `minDb: ${this.minDb}, maxDb: ${this.maxDb} (${tuningName})`;
    }

    resizeCanvases() {
        this.inputCanvas.width = 300;
        this.inputCanvas.height = 100;
        this.frequencyCanvas.width = 350;
        this.frequencyCanvas.height = 400;
    }

    calculateNoteStrengths() {
        const sampleRate = this.audioContext.sampleRate;
        const nyquist = sampleRate / 2;
        const binSize = nyquist / this.frequencyData.length;

        const strengths = this.currentFrequencies.map(f => {
            const targetFrequency = f.frequency;
            const index = Math.round(targetFrequency / binSize);
            const decibel = this.frequencyData[index] || -Infinity;
            return {
                note: f.note,
                baseNote: f.baseNote,
                strength: decibel,
                color: f.color
            };
        });

        const totalStrengths = this.notes.map(note => {
            const noteStrengths = strengths.filter(s => s.baseNote === note).map(s => s.strength);
            const totalStrength = noteStrengths.reduce((a, b) => a + Math.pow(10, b / 10), 0);
            const avgDecibel = 10 * Math.log10(totalStrength);
            return {
                note: note,
                strength: avgDecibel,
                color: this.noteColors[note]
            };
        });

        return { strengths, totalStrengths };
    }

    drawNoteStrengths({ strengths, totalStrengths }) {
        const rows = 12;
        const visibleOctaves = Object.keys(this.octaveDisplayFlags).filter(key => this.octaveDisplayFlags[key]).length; // OALLも含む
        const barWidth = (this.frequencyCanvas.width - 60) / visibleOctaves; // OALLも含めた表示オクターブ分の幅
        const barHeightUnit = (this.frequencyCanvas.height - 40) / rows;
    
        this.frequencyCanvasContext.clearRect(0, 0, this.frequencyCanvas.width, this.frequencyCanvas.height);
        this.drawAxisLabels();
    
        for (let row = 0; row < rows; row++) {
            const note = this.notes[11 - row];  // 上が高音、下が低音になるように音階を逆順に
    
            const totalStrength = totalStrengths.find(s => s.note === note);
            const normalizedTotalStrength = (totalStrength.strength - this.minDb) / (this.maxDb - this.minDb);
            const clampedTotalStrength = Math.max(0, Math.min(1, normalizedTotalStrength));
            const totalHeight = clampedTotalStrength * barHeightUnit;
            const y = row * barHeightUnit + 20;
    
            let colIndex = 0; // 有効なオクターブの列番号（左詰め）
    
            // OALLがtrueなら左詰めで描画
            if (this.octaveDisplayFlags['OALL']) {
                const xTotal = colIndex * barWidth + 40;
                this.frequencyCanvasContext.fillStyle = totalStrength.color;
                this.frequencyCanvasContext.fillRect(
                    xTotal,
                    y + (barHeightUnit - totalHeight),
                    barWidth - 2,
                    totalHeight
                );
    
                this.frequencyCanvasContext.font = '8px Noto Sans JP';
                this.frequencyCanvasContext.fillStyle = '#595959';
                this.frequencyCanvasContext.fillText(
                    totalStrength.strength.toFixed(1),
                    xTotal + (barWidth - 2) / 2,
                    y + barHeightUnit - 5
                );
                colIndex++; // OALL列の次に進む
            }
    
            // 有効なオクターブの棒グラフを描画
            for (let col = 0; col < this.octaves.length; col++) {
                const octaveKey = `O${9 - col}`; // O0, O1...のキー
                if (!this.octaveDisplayFlags[octaveKey]) continue; // フラグが false のオクターブはスキップ
    
                const octave = this.octaves[col];
                const noteStrength = strengths.find(s => s.note === note + octave);
                const normalizedStrength = (noteStrength.strength - this.minDb) / (this.maxDb - this.minDb);
                const clampedStrength = Math.max(0, Math.min(1, normalizedStrength));
                const height = clampedStrength * barHeightUnit;
                const x = colIndex * barWidth + 40;
    
                // 棒グラフの描画
                this.frequencyCanvasContext.fillStyle = noteStrength.color;
                this.frequencyCanvasContext.fillRect(
                    x,
                    y + (barHeightUnit - height),
                    barWidth - 2,
                    height
                );
    
                this.frequencyCanvasContext.font = '8px Noto Sans JP';
                this.frequencyCanvasContext.fillStyle = '#595959';
                this.frequencyCanvasContext.fillText(
                    noteStrength.strength.toFixed(1),
                    x + (barWidth - 2) / 2,
                    y + barHeightUnit - 5
                );
    
                colIndex++; // 左詰めで次のオクターブに進む
            }
        }
    }

    startRecording() {
        if (this.isRecording) return;
        this.isRecording = true;
        this.startButton.disabled = true;
        this.startButton.textContent = 'マイクにアクセス中...';
        this.recordingEndTimeDiv.textContent = '';

        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => this.handleStream(stream))
            .catch(err => this.handleError(err));
    }

    handleStream(stream) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.microphone = this.audioContext.createMediaStreamSource(stream);
        this.microphone.connect(this.analyser);

        this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
        this.timeDomainData = new Uint8Array(this.analyser.fftSize);
        this.mediaStream = stream;

        let remainingTime = this.recordingDuration;
        this.startButton.textContent = `録音中... 残り ${remainingTime} 秒`;

        const countdownInterval = setInterval(() => {
            remainingTime -= 1;
            if (remainingTime >= 0) {
                this.startButton.textContent = `録音中... 残り ${remainingTime} 秒`;
            }
        }, 1000);

        const inputStrengthInterval = setInterval(() => {
            this.analyser.getByteTimeDomainData(this.timeDomainData);
            this.drawInputStrength(this.timeDomainData);
        }, 30);

        setTimeout(() => {
            clearInterval(inputStrengthInterval);
            clearInterval(countdownInterval);
            this.startButton.textContent = `録音完了`;
            this.analyser.getFloatFrequencyData(this.frequencyData);
            const strengths = this.calculateNoteStrengths();
            this.drawNoteStrengths(strengths);
            this.displayRecordingEndTime();
            this.stopRecording();
        }, this.recordingDuration * 1000);
    }

    handleError(err) {
        console.error("マイクのアクセスに失敗しました: " + err);
        this.isRecording = false;
        this.startButton.disabled = false;
        this.startButton.textContent = "録音開始";
    }

    stopRecording() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
        this.isRecording = false;
        this.startButton.disabled = false;
        this.startButton.textContent = "録音開始";
    }

    drawInputStrength(timeDomainData) {
        this.inputCanvasContext.clearRect(0, 0, this.inputCanvas.width, this.inputCanvas.height);
        this.inputCanvasContext.lineWidth = 2;
        this.inputCanvasContext.strokeStyle = 'rgb(0, 102, 204)';
        this.inputCanvasContext.beginPath();

        const sliceWidth = this.inputCanvas.width / timeDomainData.length;
        let x = 0;

        for (let i = 0; i < timeDomainData.length; i++) {
            const v = timeDomainData[i] / 128.0;
            const y = v * this.inputCanvas.height / 2;

            if (i === 0) {
                this.inputCanvasContext.moveTo(x, y);
            } else {
                this.inputCanvasContext.lineTo(x, y);
            }

            x += sliceWidth;
        }

        this.inputCanvasContext.lineTo(this.inputCanvas.width, this.inputCanvas.height / 2);
        this.inputCanvasContext.stroke();
    }

    displayRecordingEndTime() {
        const now = new Date();
        now.setHours(now.getHours() + 9); // 日本時間（UTC+9）に変換
        const formattedTime = now.toISOString().slice(0, 19).replace('T', ' ');
        this.recordingEndTimeDiv.textContent = `recorded at (${formattedTime} JST)`;
    }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    const analyzer = new FourierToneAnalyzer();
});
