import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

const execPromise = promisify(exec);

// Step 1: Extract audio from video (requires ffmpeg)
async function extractAudio(mediaPath: string, audioPath: string): Promise<void> {
    console.log(`Starting audio extraction from: ${mediaPath}`);
    console.log(`Output audio will be saved to: ${audioPath}`);
    
    try {
        const command = `ffmpeg -i "${mediaPath}" -ar 16000 -y -ac 1 -c:a pcm_s16le "${audioPath}"`;

        console.log(`Running command: ${command}`);

        // Run the ffmpeg command and capture stdout and stderr in real time
        const childProcess = exec(command);

        // Handle real-time stdout and stderr
        childProcess.stdout?.on('data', (data) => {
            console.log('ffmpeg stdout:', data.toString());
        });

        childProcess.stderr?.on('data', (data) => {
            console.log('ffmpeg stderr:', data.toString());
        });

        // Wait for the process to finish
        await new Promise<void>((resolve, reject) => {
            childProcess.on('exit', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`ffmpeg process exited with code ${code}`));
                }
            });
        });

        // Wait until the audio file is created
        while (!fs.existsSync(audioPath)) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const stats = fs.statSync(audioPath);
        console.log(`Audio extraction complete. File size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
    } catch (error) {
        console.error('Error extracting audio:', error);
        throw error;
    }
}

// Step 2: Transcribe audio using locally installed Whisper
async function transcribeAudio(audioPath: string, options = {}): Promise<string> {
    console.log(`Starting transcription of audio file: ${audioPath}`);
    console.log(`Transcription options:`, options);

    try {
        const defaultOptions = {
            model: 'base',
            language: 'en',
        };

        const opts = { ...defaultOptions, ...options };

        // Determine whether CUDA is available
        let device = 'cpu';
        try {
            const { stdout } = await execPromise('python3 -c "import torch; print(torch.cuda.is_available())"');
            if (stdout.trim() === 'True') {
                device = 'cuda';
                console.log('CUDA is available — using GPU for transcription');
            } else {
                console.log('CUDA not available — falling back to CPU');
            }
        } catch (checkErr) {
            console.warn('Error checking CUDA availability, defaulting to CPU:', checkErr);
        }

        // Construct Whisper command with explicit output directory
        const audioDir = path.dirname(audioPath);
        const audioBaseName = path.basename(audioPath, path.extname(audioPath));
        const outputFile = path.join(audioDir, audioBaseName);
        
        let command = `whisper "${audioPath}" --model ${opts.model} --output_format srt --output_dir "${audioDir}" --device ${device}`;
        if (opts.language !== 'auto') {
            command += ` --language ${opts.language}`;
        }

        console.log(`Running command: ${command}`);
        const { stdout, stderr } = await execPromise(command);

        if (stdout) console.log('Whisper output:', stdout);
        if (stderr) console.log('Whisper error output:', stderr);

        // Whisper might add language code to filename, so we need to check multiple possibilities
        let transcriptionPath = path.join(audioDir, `${audioBaseName}.srt`);
        
        // If the basic path doesn't exist, try to find any matching SRT file
        if (!fs.existsSync(transcriptionPath)) {
            console.log(`Transcription not found at ${transcriptionPath}, searching for alternatives...`);
            
            // Look for files with similar names (Whisper might add language code)
            const dirFiles = fs.readdirSync(audioDir);
            const possibleMatches = dirFiles.filter(file => 
                file.startsWith(audioBaseName) && 
                file.endsWith('.srt')
            );
            
            if (possibleMatches.length > 0) {
                transcriptionPath = path.join(audioDir, possibleMatches[0]);
                console.log(`Found alternative transcription file: ${transcriptionPath}`);
            } else {
                throw new Error(`No transcription file found for ${audioPath}`);
            }
        }

        console.log(`Reading transcription from: ${transcriptionPath}`);
        const transcription = fs.readFileSync(transcriptionPath, 'utf8');
        console.log(`Transcription loaded, length: ${transcription.length} characters`);
        console.log(`First 100 characters: ${transcription.substring(0, 100)}...`);

        return transcription;
    } catch (error) {
        console.error('Error transcribing audio:', error);
        throw error;
    }
}

// Process a single media file
async function processMediaFile(mediaPath: string, outputDir: string, options = {}): Promise<string> {
    console.log(`Processing media file: ${mediaPath}`);
    
    const fileName = path.basename(mediaPath, path.extname(mediaPath));
    const audioPath = path.join(outputDir, `${fileName}.wav`);
    const outputPath = path.join(outputDir, `${fileName}.srt`);
    
    try {
        // Skip if the transcription already exists
        if (fs.existsSync(outputPath)) {
            console.log(`Transcription already exists for ${fileName}, skipping...`);
            return fs.readFileSync(outputPath, 'utf8');
        }
        
        // Extract audio if needed (mp3 files can skip this step)
        if (path.extname(mediaPath).toLowerCase() === '.mp4') {
            console.log('Extracting audio from video');
            await extractAudio(mediaPath, audioPath);
        } else if (path.extname(mediaPath).toLowerCase() === '.mp3') {
            // For MP3, copy to WAV format for consistency
            console.log('Converting MP3 to WAV format');
            await extractAudio(mediaPath, audioPath);
        }

        // Transcribe audio
        console.log('Transcribing audio');
        const transcription = await transcribeAudio(audioPath, options);
        
        // Save transcription to the expected output location
        fs.writeFileSync(outputPath, transcription);
        console.log(`Transcription saved to: ${outputPath}`);
        
        // Cleanup temporary WAV file
        if (fs.existsSync(audioPath)) {
            console.log(`Cleaning up temporary audio file: ${audioPath}`);
            fs.unlinkSync(audioPath);
        }
        
        return transcription;
    } catch (error) {
        console.error(`Error processing ${mediaPath}:`, error);
        throw error;
    }
}

// Process a directory of media files
async function processDirectory(inputDir: string, options = {}): Promise<void> {
    console.log(`Processing directory: ${inputDir}`);
    
    // Create output directory with the same name as the input directory
    const dirName = path.basename(inputDir);
    const outputDir = path.join(process.cwd(), 'transcripts', `${dirName}_transcriptions`);
    
    if (!fs.existsSync(outputDir)) {
        console.log(`Creating output directory: ${outputDir}`);
        fs.mkdirSync(outputDir, { recursive: true });
    } else {
        console.log(`Output directory already exists: ${outputDir}`);
    }
    
    try {
        // Get all MP3 and MP4 files in the directory
        const files = fs.readdirSync(inputDir);
        const mediaFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ext === '.mp3' || ext === '.mp4';
        });
        
        console.log(`Found ${mediaFiles.length} media files to process`);
        
        if (mediaFiles.length === 0) {
            console.log('No MP3 or MP4 files found in the directory');
            return;
        }
        
        // Process each file sequentially
        for (const file of mediaFiles) {
            const mediaPath = path.join(inputDir, file);
            console.log(`\n--- Processing file: ${file} ---`);
            
            try {
                await processMediaFile(mediaPath, outputDir, options);
                console.log(`Successfully processed: ${file}`);
            } catch (error) {
                console.error(`Failed to process ${file}:`, error);
                // Continue with the next file
            }
        }
        
        console.log(`\nBatch processing complete. Transcriptions saved to: ${outputDir}`);
    } catch (error) {
        console.error('Error processing directory:', error);
        throw error;
    }
}

// Main function to handle command-line arguments
async function main() {
    try {
        // Get directory from command line arguments
        const inputDir = process.argv[2];
        
        if (!inputDir) {
            console.error('Error: No directory specified');
            console.log('Usage: bun dev <FOLDER TO CHECK FOR MP3 AND MP4>');
            process.exit(1);
        }
        
        if (!fs.existsSync(inputDir)) {
            console.error(`Error: Directory not found: ${inputDir}`);
            process.exit(1);
        }
        
        if (!fs.statSync(inputDir).isDirectory()) {
            console.error(`Error: ${inputDir} is not a directory`);
            process.exit(1);
        }
        
        // Transcription options
        const options = {
            model: 'small',   // You can choose between tiny, base, small, medium, or large
            language: 'en'    // Using specific language instead of auto
        };
        
        console.log('Starting batch transcription process');
        await processDirectory(inputDir, options);
        
    } catch (error) {
        console.error('Error in main function:', error);
        process.exit(1);
    }
}

main();