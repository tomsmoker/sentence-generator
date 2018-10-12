// @author Michael Stewart
// @date 10/10/2018

const NUM_SENTENCES = 100; // The number of sentences to generate.

const nlp = require('./nlp');
const logger = require('./config/winston');

// A simple sentence generator.
class SentenceGenerator {
	constructor(trainingFilename = "data/train/bucket_wheel_fmea.txt",
				outputFilename = "data/output/output.txt",
				classifierFilename = "data/asset/classifier.json") {		
		var t = this;
		t.classifier = null;
		t.trainingFilename = trainingFilename;
		t.outputFilename = outputFilename;
		t.classifierFilename = classifierFilename;
	}

	// Load the pretrained classifier, the location of which is specified in the constructor.
	// @param next: The callback function to call upon completion.
	loadPretrainedClassifier(next) {
		var t = this;
		nlp.loadClassifier(t.classifierFilename, function(err, classifier) {
			if(err) { return logger.error (err); }
			logger.info("Loaded model.");
			t.classifier = classifier;
			next();
		});
	}

	// Run the NLP pipeline on the training data text files saved for a particular channel.
	// Calls the functions from the NLP module.
	// @param next: The callback function to call upon completion.
	learn(next) {		
		var t = this;
		nlp.readFileTokens(t.trainingFilename, function(err, trainingData) {
			if(err) { return logger.error(err.message); }
			var nGramsData = nlp.getNGrams(trainingData);
			nlp.trainClassifier(nGramsData, t.classifierFilename, function(err, classifier) {
				if(err) { return logger.error(err.message); }
				t.classifier = classifier;
				logger.info("Model trained on file " + t.trainingFilename + ".");
				next();
			});			
		});		
	}

	// Generate a sentence based on this SentenceGenerator's classifier.
	// @param numSentences: The number of sentences to generate
	// @param filename: the filename to save the sentences to.
	// @param next: The callback function to call upon completion.
	generate(numSentences = NUM_SENTENCES, filename = this.outputFilename, next) {
		var t = this;
		nlp.generateSentences(t.classifier, numSentences, function(err, sentences) {
			if(err) { return logger.error(err.message); }
			nlp.writeSentencesToFile(sentences, filename, function(err) {
				if(err) { return logger.error(err.message); }
				next();
			});
		});
	}
}


var sentenceGenerator = new SentenceGenerator();
sentenceGenerator.learn(function() {
	sentenceGenerator.generate();
});

// An example of running from a pretrained classifier:


// var sentenceGenerator = new SentenceGenerator();
// sentenceGenerator.loadPretrainedClassifier(function() {
// 	sentenceGenerator.generate();
// });



