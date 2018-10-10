// @author Michael Stewart
// @date 10/10/2018

const natural = require('natural');
const fs = require('fs');
const NGrams = natural.NGrams;
const tokenizer = new natural.WordPunctTokenizer();

const logger = require('./config/winston');

const EOS_TOKEN = "<EOS>";
const SOS_TOKEN = "<SOS>";
const NGRAM_N = 1;       // The 'n' in nGram (the context window size to use for predictions). I've found 1 works best, because 2
						 // doesn't actually predict using the order of the words.
const TOP_N_OPTIONS = 5; 		 // Max number of words to select from at random. Higher numbers produce 'more random' results.
const TOP_N_OPTIONS_START = 30; // Max number of words to select from at random at the very beginning of the sentence.
const MAX_TRAINING_LINES_PER_FILE = 10000; //Number.MAX_SAFE_INTEGER; // Maximum number of lines to learn from from a file. Can be made smaller to save training time if you	
															 // have a large file.

const MIN_SENT_LENGTH = 6;	// The minimum sentence length.

// Load a pre-trained Bayes classifier.
// @param filename: The filename of the classifier to load.
// @param next: The callback function to call upon completion.
module.exports.loadClassifier = function(filename, next) {
  natural.BayesClassifier.load(filename, null, function(err, classifier) {
    if(err) return next(err, classifier);
    next(err, classifier);
  });
}

// Tokenize a line. Return null if the line is a command beginning with a '!'.
// Prepend the start of sentence token to the line.
// @param line: The line to clean and tokenize.
// @return tokens: An array of tokens.
cleanAndTokenize = function(line) {
  //fs.appendFileSync('data/train/testing2/messages.txt', line + "\n" );
  if (line.substring(0, 1) != '!') {
    //var dirtyTokens = tokenizer.tokenize(line);
    var dirtyTokens = line.split(' ');
    var tokens = [];

    for(var i in dirtyTokens) {
      //if(dirtyTokens[i].search(/\d+|\//) === -1) { // Don't include tokens that have numbers in them
      if(dirtyTokens[i].search(/[^a-zA-Z]/) === -1) { // Don't include tokens that have numbers in them
        tokens.push(dirtyTokens[i]);
      }
    }

    if(tokens.length > 0)  {
      tokens.unshift(SOS_TOKEN);      
      tokens.push(EOS_TOKEN);      
      return tokens;
    }
  }  
}
module.exports.cleanAndTokenize = cleanAndTokenize;

// Recursively ad all files in the given directory.
// @param trainingDir: The training file to read from.
// @param next: The callback function to call upon completion.
readFileTokens = function(filename, next) {
  var trainingData = [];
  fs.readFile(filename, function(err, data) {
    var lines = data.toString().split("\n").slice(0, MAX_TRAINING_LINES_PER_FILE);
    for(var i in lines) {
      var tokens = cleanAndTokenize(lines[i])
      if(tokens) {
        trainingData.push(tokens);
      }
    }
    return next(err, trainingData);
  });
}
module.exports.readFileTokens = readFileTokens;

// Gets all the ngrams of tokenized sentences.
// ngram size is determined by NGRAM_N.
// @param trainingData: An array of arrays, where each inner array is a tokenized seentence.
module.exports.getNGrams = function(trainingData) {
  var nGramsData = []; // Contains arrays [['word1'], 'word2'];
  for(var i in trainingData) {
    var ng = NGrams.ngrams(trainingData[i], NGRAM_N+1);
    for(var j in ng) {
      if(ng[j].length > 1) {
        nGramsData.push([ng[j].splice(0, ng[j].length-1), ng[j][ng[j].length-1]]);
      }
    }
  }

  return nGramsData;
}

// Train a new classifier based on ngram data.
// Saves the classifier to the given trainingDir.
// @param nGramsData: An array of arrays, where each inner array is a list of ngrams.
// @param trainingDir: The directory to save the classifier under. It will always be saved as 'classifier.json' within that directory.
// @param next: The callback function to call upon completion.
module.exports.trainClassifier = function(nGramsData, classifierFilename, next) {
  var classifier = new natural.BayesClassifier();
  for(var i in nGramsData) {
    classifier.addDocument(nGramsData[i][0], nGramsData[i][1]);       
  }
  logger.info("Training classifier...");
    
  classifier.events.on('trainedWithDocument', function(data) {
    if(data['index'] % 1000 == 0) {
      logger.info(data['index'] + ' / ' + data['total'] + ' n-grams processed.')
    }
  });

  // Unnecessary to use a function here, but it is useful if using the asynchronous version of classifier.train().
  function saveAndFinish() {
    logger.info("Training complete.")
    if(!classifierFilename) {
      return next(null, classifier);
    }
    classifier.save(classifierFilename, function(err) {
      next(err, classifier);
    });   
  };

  classifier.train();
  saveAndFinish();
}

// Produce a sentence based on the classifier.
// The sentence starts out as a SOS token, and the model predicts the next word based on a random choice from a
// list of the top predictions.
// @param classifier: The classifier to use for predictions.
// @param next: The callback function to call upon completion.
generateSentence = function(classifier, next) {
  var t = this;

  if(classifier == null) {
    return next(new Error("Classifier has not been trained and cannot yet generate a sentence."));
  }

  // Builds a sentence recursively.
  // @param: The current sentence (an array of words).
  // @param next: The callback function to call upon completion.
  function buildSentence(sentence, next) {
    // var shushChance = Math.min(1, (Math.max(0, sentence.length-5) ** Math.random() * 1) / 100);
    // if(Math.random() < shushChance) {
    //   return next(null, sentence);
    // }
    var classifications = classifier.getClassifications(sentence.slice(Math.max(sentence.length - NGRAM_N, 0)));

    // Select from more words at the start of the sentence to stop the same thing being generated every time.
    if(sentence.length == 1) topn = TOP_N_OPTIONS_START; 
    else topn = TOP_N_OPTIONS;
    
    // Generate a list of options and select the first topn most probable ones.
    var options = classifications.slice(0, Math.min(classifications.length, topn));
    var option = options[Math.floor(Math.random() * options.length)]
    if(!option) { // If there are no options to choose from, or the classifier predicted the end of sentence token, the sentence is complete.
      return next(null, sentence);
    } else if(option["label"] == EOS_TOKEN) {
    	if(sentence.length > MIN_SENT_LENGTH) { return next(null, sentence); }
    } else {
    	sentence.push(option["label"]);
    }
    
    buildSentence(sentence, next);
  }

  buildSentence([SOS_TOKEN], function(err, sentence) {  	
    var s = sentence.slice(1, sentence.length-1).join(" ");
    logger.debug(s);
    next(err, s);
  }); 
}
module.exports.generateSentence = generateSentence;

// Generate an array of sentences by repeatedly calling the generateSentence function.
// @param classifier: The classifier to use to generate the sentences.
// @param numSentences: The number of sentences to generate.
// @param next: The callback function to call upon completion.
module.exports.generateSentences = function(classifier, numSentences, next) {
	logger.info("Generating " + numSentences + " sentences...");
	var sentences = [];
	for(var i = 0; i < numSentences; i++) {
		generateSentence(classifier, function(err, sentence) {
			if(err) { next(err); }
			if(i % 100 == 0) {
		      logger.info(i+ ' / ' + numSentences + ' sentences generated.')
		    }
			sentences.push(sentence);
			if(sentences.length == numSentences) {
				next(null, sentences);
			}			
		});
	}
}

// Write an array of sentences to a file.
// @param sentences: The array of sentences to write.
// @param filename: The filename to write the sentences to.
// @param next: The callback function to call upon completion.
module.exports.writeSentencesToFile = function(sentences, filename, next) {
	logger.info("Saving sentences to file " + filename + "...");
	var file = fs.createWriteStream(filename);
	file.on('error', function(err) { next(err); });
	sentences.forEach(function(v) { file.write(v + '\n'); });
	file.end(function() { logger.info("All done."); });

}