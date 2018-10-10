# sentence-generator
A simple Naive Bayesian sentence generator written in node.js.

## Running the generator

To set up the application, first install the node modules:

    npm install
    
Place your training data into `data/train/`. It'll need to have the same format as `example.txt` (i.e. one sentence per line).

You can then go in to `sentence_generator.js` and modify the `trainingFilename = "..."` (line 11) to the name of your file.

Then, run the sentence generator:

    node sentence_generator.js
    
Your data will be split into bi-grams, fed into the classifier, and once it's done training it will produce sentences and save them to `data/output/output.txt`. 

## Options

There is one main option in the `sentence_generator.js` file:
- `NUM_SENTENCES` determines the number of sentences to generate and write to the output file.

There are a few options in the `nlp.js` file:
- `TOP_N_OPTIONS` determines how many possible words the classifier will choose from when predicting the next word in the sentence.
- `TOP_N_OPTIONS_START` is the same as the above, but only applies to the first word of the sentence.
- `MAX_TRAINING_LINES_PER_FILE` determines how many lines of the file the classifier should train from.
- `MIN_SENT_LENGTH` ensures all sentences are greater than a certain length.

## How it works

The Naive Bayes classifier predicts a word given a word. The sentence generation runs a sequence of predictions, starting from the start of sentence token (`<SOS>`) and ending when it predicts the end of sentence token (`<EOS>`). It has no idea about any words prior to the previous word, so it isn't very good when compared to state-of-the-art neural machine translation models. It does, however, generate some reasonable-looking sentences.

Each sentence is tokenised, punctuation is removed, and then it is split into bi-grams to feed into the classifier. For example, the sentence:

    Person was walking around.

Will be converted to:

    [['<SOS>'], 'person'],
    [['person'], 'was'],
    [['was'], 'walking'],
    [['walking'], 'around'],
    [['around'], '<EOS>']]

The "Natural" library's NaiveBayesClassifier then trains from this data and is used to generate sentences as mentioned above.

## Notes

It's very slow, unfortunately. It only runs on a CPU. It is possible to run on multiple cores by changing the `classifier.train()` line in `nlp.js`, but I didn't have much success with it (it threw a lot of errors) so I gave up.

I did originally attempt to use ngrams instead of bi-grams, but found that the Naive Bayes classifier was predicting a word regardless of the order of the context words, so it ended up being pretty useless. Predicting the next word given the current word seems to produce the most human-readable results.
