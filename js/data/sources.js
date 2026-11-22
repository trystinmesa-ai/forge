// References behind the programming rules. Only works that exist and that say
// roughly what we use them for. Where a rule goes beyond them, it is labelled 'estimate'.
export const SOURCES = {
  acsm2009: {
    short: 'ACSM 2009',
    full: 'American College of Sports Medicine. Progression models in resistance training for healthy adults. Med Sci Sports Exerc. 2009;41(3):687–708.',
  },
  nscaEssentials: {
    short: 'NSCA Essentials',
    full: 'Haff GG, Triplett NT, eds. Essentials of Strength Training and Conditioning. 4th ed. NSCA / Human Kinetics; 2016.',
  },
  schoenfeld2017volume: {
    short: 'Schoenfeld et al. 2017 (volume)',
    full: 'Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis. J Sports Sci. 2017;35(11):1073–1082.',
  },
  schoenfeld2017load: {
    short: 'Schoenfeld et al. 2017 (load)',
    full: 'Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW. Strength and hypertrophy adaptations between low- vs. high-load resistance training: a systematic review and meta-analysis. J Strength Cond Res. 2017;31(12):3508–3523.',
  },
  schoenfeld2016freq: {
    short: 'Schoenfeld et al. 2016 (frequency)',
    full: 'Schoenfeld BJ, Ogborn D, Krieger JW. Effects of resistance training frequency on measures of muscle hypertrophy: a systematic review and meta-analysis. Sports Med. 2016;46(11):1689–1697.',
  },
  refalo2023: {
    short: 'Refalo et al. 2023',
    full: 'Refalo MC, Helms ER, Trexler ET, Hamilton DL, Fyfe JJ. Influence of resistance training proximity-to-failure on skeletal muscle hypertrophy: a systematic review with meta-analysis. Sports Med. 2023;53(3):649–665.',
  },
  who2020: {
    short: 'WHO 2020',
    full: 'World Health Organization. WHO guidelines on physical activity and sedentary behaviour. Geneva: WHO; 2020.',
  },
};

/** How sure we are about a rule. Shown next to it in the app. */
export const BASIS = {
  guideline: 'Established guideline',
  estimate: 'Reasonable estimate',
  preference: 'Your preference',
};
