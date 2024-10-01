class FourierToneAnalyzer {
    constructor() {
        this.startButton = document.getElementById('startRecording');
        this.inputCanvas = document.getElementById('inputStrengthCanvas');
        this.inputCanvasContext = this.inputCanvas.getContext('2d');
        this.frequencyCanvas = document.getElementById('frequencyCanvas');
        this.frequencyCanvasContext = this.frequencyCanvas.getContext('2d');
        this.recordingEndTimeDiv = document.getElementById('recordingEndTime');

        this.minDb = -150;
        this.maxDb = -30;

        this.octaveDisplayFlags = {
            'O0': true,  'O1': true, 'O2': false, 'O3': false, 'O4': false,
            'O5': false, 'O6': true, 'O7': true,  'O8': true, 'O9': true, 
            'OALL': false
        }; // 各オクターブの表示フラグをディクショナリ形式で設定
        this.buttonConfigurations = [
            { minDb: -150, maxDb: -30 },
            { minDb: -150, maxDb: -50 },
            { minDb: -100, maxDb: -30 },
            { minDb: -100, maxDb: -50 },
            { minDb: -100, maxDb: -80 }
        ];

        this.notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        this.octaves = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
        this.noteColors = {
            'C': '#E57373', 'C#': '#FF8A65', 'D': '#FFB74D', 'D#': '#FFD54F',
            'E': '#FFF176', 'F': '#AED581', 'F#': '#81C784', 'G': '#4DD0E1',
            'G#': '#4FC3F7', 'A': '#7986CB', 'A#': '#BA68C8', 'B': '#F06292'
        };

        this.frequencies = this.calculateFrequencies();
        this.recordingDuration = 10; // 録音時間を10秒に設定
        this.isRecording = false; // 録音中かどうかを管理するフラグ
        this.init();
    }

    init() {
        this.startButton.addEventListener('click', () => this.startRecording());

        // 5つのボタン（A-E）を設定
        for (let i = 0; i < 5; i++) {
            document.getElementById(`button${String.fromCharCode(65 + i)}`).addEventListener('click', () => {
                this.setDbRange(i);
            });
        }

        this.resizeCanvases();
        this.drawAxisLabels();
    }

    resizeCanvases() {
        this.inputCanvas.width = 300;
        this.inputCanvas.height = 100;
        this.frequencyCanvas.width = 350;
        this.frequencyCanvas.height = 400;
        this.drawAxisLabels();
    }

    calculateFrequencies() {
        let frequencies = [];
        this.octaves.forEach(octave => {
            this.notes.forEach((note) => {
                const frequency = 16.35 * Math.pow(2, octave + this.notes.indexOf(note) / 12);
                frequencies.push({ note: note + octave, frequency: frequency, color: this.noteColors[note], baseNote: note });
            });
        });
        return frequencies;
    }

    drawAxisLabels() {
        const rows = 12;
        const visibleOctaves = Object.keys(this.octaveDisplayFlags).filter(key => this.octaveDisplayFlags[key]).length; // OALLも含む
        const barWidth = (this.frequencyCanvas.width - 60) / visibleOctaves; // OALLも含めた表示オクターブ分の幅
    
        this.frequencyCanvasContext.clearRect(0, 0, this.frequencyCanvas.width, this.frequencyCanvas.height);
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


    setDbRange(index) {
        const config = this.buttonConfigurations[index];
        this.minDb = config.minDb;
        this.maxDb = config.maxDb;
        this.drawNoteStrengths(this.calculateNoteStrengths());
    }

    startRecording() {
        if (this.isRecording) return;
        this.isRecording = true;
        this.startButton.disabled = true;
        this.startButton.textContent = 'マイクにアクセス中...';
        this.drawAxisLabels();
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

    calculateNoteStrengths() {
        const sampleRate = this.audioContext.sampleRate;
        const nyquist = sampleRate / 2;
        const binSize = nyquist / this.frequencyData.length;

        const strengths = this.frequencies.map(f => {
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
    
        this.drawAxisLabels(); // ラベルを再描画
    
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

    displayRecordingEndTime() {
        const now = new Date();
        const formattedTime = now.toISOString().slice(0, 19).replace('T', ' ');
        this.recordingEndTimeDiv.textContent = `recorded at (${formattedTime})`;
    }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    const analyzer = new FourierToneAnalyzer();
});
