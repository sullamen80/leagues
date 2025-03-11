// src/gameTypes/marchMadness/components/Rules.js
import React from 'react';
import { FaTrophy, FaClipboardList, FaCalendarAlt, FaQuestionCircle } from 'react-icons/fa';

/**
 * Component for displaying March Madness tournament rules
 */
const Rules = () => {
  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-3xl font-bold text-center mb-8 text-indigo-800">March Madness Tournament Rules</h1>
      
      <div className="space-y-8">
        {/* Tournament Overview */}
        <section>
          <div className="flex items-center mb-4">
            <FaTrophy className="text-yellow-500 text-2xl mr-3" />
            <h2 className="text-xl font-bold text-gray-800">Tournament Overview</h2>
          </div>
          <div className="pl-10 space-y-3">
            <p>
              NCAA March Madness is a single-elimination tournament featuring 68 college basketball teams competing for the national championship.
            </p>
            <p>
              The tournament begins with the "First Four" play-in games, followed by the main 64-team bracket divided into four regions: East, West, Midwest, and South.
            </p>
            <p>
              Teams are seeded 1-16 in each region, with higher seeds (lower numbers) generally representing stronger teams.
            </p>
          </div>
        </section>
        
        {/* Bracket Challenge Rules */}
        <section>
          <div className="flex items-center mb-4">
            <FaClipboardList className="text-indigo-500 text-2xl mr-3" />
            <h2 className="text-xl font-bold text-gray-800">Bracket Challenge Rules</h2>
          </div>
          <div className="pl-10 space-y-3">
            <p>
              <strong>Fill out your bracket:</strong> Before the tournament begins, pick winners for every game through all six rounds.
            </p>
            <p>
              <strong>Bracket lock:</strong> All brackets lock when the first Round of 64 game begins. No changes can be made after this point.
            </p>
            <p>
              <strong>Scoring system:</strong>
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>Round of 64: 1 point per correct pick</li>
              <li>Round of 32: 2 points per correct pick</li>
              <li>Sweet 16: 4 points per correct pick</li>
              <li>Elite Eight: 8 points per correct pick</li>
              <li>Final Four: 16 points per correct pick</li>
              <li>Championship: 32 points for correct champion</li>
            </ul>
            <p>
              <strong>Winner determination:</strong> The participant with the highest total score at the end of the tournament wins.
            </p>
            <p>
              <strong>Tiebreakers:</strong> In case of a tie, the participant who correctly picked the champion wins. If still tied, the participant with more correct picks in earlier rounds wins.
            </p>
          </div>
        </section>
        
        {/* Tournament Schedule */}
        <section>
          <div className="flex items-center mb-4">
            <FaCalendarAlt className="text-green-500 text-2xl mr-3" />
            <h2 className="text-xl font-bold text-gray-800">Tournament Schedule</h2>
          </div>
          <div className="pl-10 space-y-3">
            <p>The tournament typically follows this schedule:</p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li><strong>Selection Sunday:</strong> Teams and seeds are announced</li>
              <li><strong>First Four:</strong> Tuesday-Wednesday after Selection Sunday</li>
              <li><strong>First/Second Rounds:</strong> Thursday-Sunday following First Four</li>
              <li><strong>Sweet 16 & Elite Eight:</strong> Thursday-Sunday of the second weekend</li>
              <li><strong>Final Four:</strong> Saturday of the third weekend</li>
              <li><strong>Championship Game:</strong> Monday after the Final Four</li>
            </ul>
            <p className="italic text-sm">
              Note: The exact dates may vary from year to year. Check with your league administrator for this year's specific tournament schedule.
            </p>
          </div>
        </section>
        
        {/* FAQ */}
        <section>
          <div className="flex items-center mb-4">
            <FaQuestionCircle className="text-blue-500 text-2xl mr-3" />
            <h2 className="text-xl font-bold text-gray-800">Frequently Asked Questions</h2>
          </div>
          <div className="pl-10 space-y-4">
            <div>
              <h3 className="font-bold text-gray-700">What happens if a game is canceled or forfeited?</h3>
              <p className="text-gray-600">
                If a game is forfeited or canceled, the advancing team is considered the winner for scoring purposes. Adjustments may be made at the discretion of the league administrator.
              </p>
            </div>
            
            <div>
              <h3 className="font-bold text-gray-700">Can I edit my bracket after submitting it?</h3>
              <p className="text-gray-600">
                Yes, you can edit your bracket as many times as you want until the tournament locks at the start of the first Round of 64 game.
              </p>
            </div>
            
            <div>
              <h3 className="font-bold text-gray-700">How does scoring work for upsets?</h3>
              <p className="text-gray-600">
                All correct picks are worth the same number of points within each round, regardless of whether they were upsets or not.
              </p>
            </div>
            
            <div>
              <h3 className="font-bold text-gray-700">What if I miss the deadline to submit my bracket?</h3>
              <p className="text-gray-600">
                If you join a league after brackets are locked, you won't be able to participate in the bracket challenge for that tournament.
              </p>
            </div>
          </div>
        </section>
        
        {/* Additional Resources */}
        <section className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Additional Resources</h2>
          <p className="mb-2">
            For more information about NCAA March Madness, visit:
          </p>
          <ul className="list-disc list-inside pl-4">
            <li>NCAA Official Website: <a href="https://www.ncaa.com/march-madness" className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer">www.ncaa.com/march-madness</a></li>
            <li>CBS Sports Tournament Coverage: <a href="https://www.cbssports.com/college-basketball/ncaa-tournament/" className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer">www.cbssports.com/college-basketball/ncaa-tournament/</a></li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default Rules;