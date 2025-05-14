import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

const execPromise = promisify(exec);

// Step 1: Extract audio from video (requires ffmpeg)
async function extractAudio(videoPath: string, audioPath: string): Promise<void> {
    console.log(`Starting audio extraction from: ${videoPath}`);
    console.log(`Output audio will be saved to: ${audioPath}`);
    
    try {
        console.log('Running ffmpeg command...');
        const { stdout, stderr } = await execPromise(`ffmpeg -i "${videoPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${audioPath}"`);
        
        if (stderr) {
            console.log('ffmpeg process output:', stderr);
        }
        
        // Check if the audio file was created successfully
        if (fs.existsSync(audioPath)) {
            const stats = fs.statSync(audioPath);
            console.log(`Audio extraction complete. File size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
        } else {
            throw new Error('Audio file was not created');
        }
    } catch (error) {
        console.error('Error extracting audio:', error);
        throw error;
    }
}

// Step 2: Transcribe audio using locally installed Whisper
async function transcribeAudio(audioPath: string, options = {}): Promise<string> {
    console.log(`Starting transcription of audio file: ${audioPath}`);
    console.log(`Transcription options:`, options);
    const numCores = os.cpus().length;
    
    try {
        // Default options
        const defaultOptions = {
            model: 'base', // Options: tiny, base, small, medium, large
            language: 'en',  // Language code (auto-detection is handled differently)
        };

        const opts = { ...defaultOptions, ...options };
        
        // Handle the special case for auto language detection and use a format with timestamps
        let command = '';
        if (opts.language === 'auto') {
            console.log(`Using Whisper model: ${opts.model}, with automatic language detection`);
            // For auto language detection, don't specify the language parameter
            // Use srt format for timestamps
            command = `whisper "${audioPath}" --model ${opts.model} --output_format srt --threads ${numCores}`;
        } else {
            console.log(`Using Whisper model: ${opts.model}, language: ${opts.language}`);
            command = `whisper "${audioPath}" --model ${opts.model} --language ${opts.language} --output_format srt --threads ${numCores}`;
        }
        
        console.log(`Running command: ${command}`);

        const { stdout, stderr } = await execPromise(command);
        
        if (stdout) {
            console.log('Whisper output:', stdout);
        }
        if (stderr) {
            console.log('Whisper error output:', stderr);
        }

        // Whisper saves the output in the same directory with the specified extension
        const transcriptionPath = audioPath.replace(/\.[^/.]+$/, '') + '.srt';
        console.log(`Looking for transcription file at: ${transcriptionPath}`);
        
        if (!fs.existsSync(transcriptionPath)) {
            throw new Error(`Transcription file not found at ${transcriptionPath}`);
        }
        
        const transcription = fs.readFileSync(transcriptionPath, 'utf8');
        console.log(`Transcription loaded, length: ${transcription.length} characters`);
        console.log(`First 100 characters: ${transcription.substring(0, 100)}...`);

        return transcription;
    } catch (error) {
        console.error('Error transcribing audio:', error);
        throw error;
    }
}

// Main function to process a video
async function transcribeVideo(videoPath: string, outputDir: string = './output', options = {}): Promise<string> {
    console.log(`Starting video transcription process`);
    console.log(`Video path: ${videoPath}`);
    console.log(`Output directory: ${outputDir}`);
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        console.log(`Creating output directory: ${outputDir}`);
        fs.mkdirSync(outputDir, { recursive: true });
    } else {
        console.log(`Output directory already exists: ${outputDir}`);
    }

    const videoFileName = path.basename(videoPath, path.extname(videoPath));
    const audioPath = path.join(outputDir, `${videoFileName}.wav`);
    console.log(`Video file name: ${videoFileName}`);
    console.log(`Audio will be saved at: ${audioPath}`);

    try {
        console.log('Step 1: Extracting audio from video');
        // Extract audio from video
        await extractAudio(videoPath, audioPath);

        console.log('Step 2: Transcribing audio');
        // Transcribe audio
        const transcription = await transcribeAudio(audioPath, options);

        console.log('Transcription process completed successfully');
        // Optionally cleanup the audio file if you don't need it
        // fs.unlinkSync(audioPath);
        // console.log(`Cleaned up temporary audio file: ${audioPath}`);

        return transcription;
    } catch (error) {
        console.error('Error processing video:', error);
        throw error;
    }
}

// Example usage
async function main() {
    console.log('Starting main function');
    const videoPath = '/Volumes/UBUNTU 25_0/How your Jaw and Teeth mess up your Posture.mp4';
    console.log(`Processing video: ${videoPath}`);

    try {
        console.log('Calling transcribeVideo function');
        const transcription = await transcribeVideo(videoPath, './output', {
            model: 'small',   // You can choose between tiny, base, small, medium, or large
            language: 'en'    // Using specific language instead of auto
        });
        
        console.log('Transcription completed successfully!');
        console.log(`Transcription length: ${transcription.length} characters`);
        console.log('First 150 characters of transcription:');
        console.log(transcription.substring(0, 150) + '...');
        
        // Optionally save the transcription to a specific file
        const outputPath = './output/final_transcription.srt';
        fs.writeFileSync(outputPath, transcription);
        console.log(`Saved final transcription to: ${outputPath}`);
    } catch (error) {
        console.error('Error in main function:', error);
    }
}

main();