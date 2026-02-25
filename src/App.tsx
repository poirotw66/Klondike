import React, { useState } from 'react';
import { Card } from './components/Card';
import { EmptySlot } from './components/EmptySlot';
import { GameState, DragSource, CardType } from './types';
import { dealGame } from './utils/deck';
import { canMoveToTableau, canMoveToFoundation } from './utils/gameLogic';
import { RotateCcw, Undo2 } from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(dealGame());

  const saveHistory = (state: GameState) => {
    return {
      tableau: state.tableau.map(col => col.map(c => ({ ...c }))),
      foundation: state.foundation.map(pile => pile.map(c => ({ ...c }))),
      waste: state.waste.map(c => ({ ...c })),
      stock: state.stock.map(c => ({ ...c })),
    };
  };

  const executeMove = (source: DragSource, target: { type: 'tableau' | 'foundation', index: number }, cardsToMove: CardType[]) => {
    setGameState(prevState => {
      const nextState = {
        ...prevState,
        tableau: prevState.tableau.map(col => [...col]),
        foundation: prevState.foundation.map(pile => [...pile]),
        waste: [...prevState.waste],
        stock: [...prevState.stock],
        history: [...prevState.history, saveHistory(prevState)]
      };

      // Remove from source
      if (source.type === 'tableau') {
        nextState.tableau[source.colIndex].splice(source.cardIndex);
        const col = nextState.tableau[source.colIndex];
        if (col.length > 0 && !col[col.length - 1].faceUp) {
          col[col.length - 1] = { ...col[col.length - 1], faceUp: true };
        }
      } else if (source.type === 'waste') {
        nextState.waste.pop();
      } else if (source.type === 'foundation') {
        nextState.foundation[source.pileIndex].pop();
      }

      // Add to target
      if (target.type === 'tableau') {
        nextState.tableau[target.index].push(...cardsToMove);
      } else if (target.type === 'foundation') {
        nextState.foundation[target.index].push(...cardsToMove);
      }

      return nextState;
    });
  };

  const attemptMove = (source: DragSource, target: { type: 'tableau' | 'foundation', index: number }) => {
    const state = gameState;
    let cardsToMove: CardType[] = [];
    
    if (source.type === 'tableau') {
      cardsToMove = state.tableau[source.colIndex].slice(source.cardIndex);
    } else if (source.type === 'waste') {
      if (state.waste.length === 0) return;
      cardsToMove = [state.waste[state.waste.length - 1]];
    } else if (source.type === 'foundation') {
      if (state.foundation[source.pileIndex].length === 0) return;
      cardsToMove = [state.foundation[source.pileIndex][state.foundation[source.pileIndex].length - 1]];
    }

    if (cardsToMove.length === 0) return;

    const movingCard = cardsToMove[0];

    if (target.type === 'tableau') {
      const targetCol = state.tableau[target.index];
      const targetTopCard = targetCol.length > 0 ? targetCol[targetCol.length - 1] : undefined;
      if (canMoveToTableau(movingCard, targetTopCard)) {
        executeMove(source, target, cardsToMove);
      }
    } else if (target.type === 'foundation') {
      if (cardsToMove.length > 1) return; // Can only move 1 card to foundation
      const targetPile = state.foundation[target.index];
      const targetTopCard = targetPile.length > 0 ? targetPile[targetPile.length - 1] : undefined;
      if (canMoveToFoundation(movingCard, targetTopCard)) {
        executeMove(source, target, cardsToMove);
      }
    }
  };

  const handleDragStart = (e: React.DragEvent, source: DragSource) => {
    e.dataTransfer.setData('application/json', JSON.stringify(source));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnTableau = (e: React.DragEvent, colIndex: number) => {
    e.preventDefault();
    try {
      const source: DragSource = JSON.parse(e.dataTransfer.getData('application/json'));
      attemptMove(source, { type: 'tableau', index: colIndex });
    } catch (err) {
      // ignore invalid drops
    }
  };

  const handleDropOnFoundation = (e: React.DragEvent, pileIndex: number) => {
    e.preventDefault();
    try {
      const source: DragSource = JSON.parse(e.dataTransfer.getData('application/json'));
      attemptMove(source, { type: 'foundation', index: pileIndex });
    } catch (err) {
      // ignore invalid drops
    }
  };

  const handleDoubleClick = (source: DragSource) => {
    const state = gameState;
    let card: CardType | undefined;
    
    if (source.type === 'tableau') {
      const col = state.tableau[source.colIndex];
      if (source.cardIndex === col.length - 1) {
        card = col[source.cardIndex];
      }
    } else if (source.type === 'waste') {
      card = state.waste[state.waste.length - 1];
    }

    if (!card) return;

    for (let i = 0; i < 4; i++) {
      const pile = state.foundation[i];
      const topCard = pile.length > 0 ? pile[pile.length - 1] : undefined;
      if (canMoveToFoundation(card, topCard)) {
        executeMove(source, { type: 'foundation', index: i }, [card]);
        return;
      }
    }
  };

  const drawCard = () => {
    setGameState(prevState => {
      if (prevState.stock.length === 0) return prevState;
      
      const nextState = {
        ...prevState,
        stock: [...prevState.stock],
        waste: [...prevState.waste],
        history: [...prevState.history, saveHistory(prevState)]
      };

      const card = nextState.stock.pop()!;
      card.faceUp = true;
      nextState.waste.push(card);

      return nextState;
    });
  };

  const recycleWaste = () => {
    setGameState(prevState => {
      if (prevState.stock.length > 0 || prevState.waste.length === 0) return prevState;

      const nextState = {
        ...prevState,
        stock: [...prevState.waste].reverse().map(c => ({ ...c, faceUp: false })),
        waste: [],
        history: [...prevState.history, saveHistory(prevState)]
      };

      return nextState;
    });
  };

  const undo = () => {
    setGameState(prevState => {
      if (prevState.history.length === 0) return prevState;
      const previous = prevState.history[prevState.history.length - 1];
      return {
        ...previous,
        history: prevState.history.slice(0, -1)
      };
    });
  };

  const isGameWon = gameState.foundation.every(pile => pile.length === 13);

  return (
    <div className="min-h-screen bg-emerald-800 text-white p-4 md:p-8 font-sans select-none">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Klondike Solitaire</h1>
          <div className="flex gap-4">
            <button 
              onClick={undo} 
              disabled={gameState.history.length === 0} 
              className="flex items-center gap-2 px-4 py-2 bg-black/20 rounded-lg hover:bg-black/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Undo2 size={20} /> <span className="hidden sm:inline">Undo</span>
            </button>
            <button 
              onClick={() => setGameState(dealGame())} 
              className="flex items-center gap-2 px-4 py-2 bg-black/20 rounded-lg hover:bg-black/30 transition-colors"
            >
              <RotateCcw size={20} /> <span className="hidden sm:inline">New Game</span>
            </button>
          </div>
        </div>

        {/* Top Row: Stock, Waste, Foundations */}
        <div className="flex justify-between mb-12 gap-4 overflow-x-auto pb-4">
          <div className="flex gap-4 shrink-0">
            {/* Stock */}
            <div onClick={gameState.stock.length > 0 ? drawCard : recycleWaste} className="cursor-pointer shrink-0">
              {gameState.stock.length > 0 ? (
                <Card faceDown />
              ) : (
                <div className="w-24 h-36 rounded-xl border-2 border-black/20 flex items-center justify-center hover:bg-black/10 transition-colors">
                  <RotateCcw className="text-black/30" size={32} />
                </div>
              )}
            </div>
            
            {/* Waste */}
            <div className="relative w-24 h-36 shrink-0">
              {gameState.waste.length === 0 ? (
                <EmptySlot />
              ) : (
                gameState.waste.map((card, index) => {
                  if (index < gameState.waste.length - 3) return null;
                  const displayIndex = index - Math.max(0, gameState.waste.length - 3);
                  const isTop = index === gameState.waste.length - 1;
                  return (
                    <div 
                      key={card.id} 
                      className="absolute top-0 left-0"
                      style={{ transform: `translateX(${displayIndex * 20}px)` }}
                    >
                      <Card 
                        card={card} 
                        isDraggable={isTop}
                        onDragStart={(e) => isTop && handleDragStart(e, { type: 'waste' })}
                        onDoubleClick={() => isTop && handleDoubleClick({ type: 'waste' })}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Foundations */}
          <div className="flex gap-4 shrink-0 ml-auto">
            {gameState.foundation.map((pile, index) => (
              <div 
                key={`foundation-${index}`}
                className="relative w-24 h-36 shrink-0"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnFoundation(e, index)}
              >
                <EmptySlot />
                {pile.map((card, cardIndex) => (
                  <div key={card.id} className="absolute top-0 left-0">
                    <Card 
                      card={card}
                      isDraggable={cardIndex === pile.length - 1}
                      onDragStart={(e) => handleDragStart(e, { type: 'foundation', pileIndex: index })}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Row: Tableau */}
        <div className="flex justify-between gap-2 sm:gap-4 overflow-x-auto pb-8">
          {gameState.tableau.map((col, colIndex) => (
            <div 
              key={`tableau-${colIndex}`}
              className="relative w-24 min-h-[60vh] shrink-0"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropOnTableau(e, colIndex)}
            >
              <EmptySlot />
              {col.map((card, cardIndex) => (
                <div 
                  key={card.id} 
                  className="absolute top-0 left-0"
                  style={{ top: `${col.slice(0, cardIndex).reduce((acc, c) => acc + (c.faceUp ? 28 : 12), 0)}px` }}
                >
                  <Card 
                    card={card}
                    isDraggable={card.faceUp}
                    onDragStart={(e) => card.faceUp && handleDragStart(e, { type: 'tableau', colIndex, cardIndex })}
                    onDoubleClick={() => card.faceUp && handleDoubleClick({ type: 'tableau', colIndex, cardIndex })}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      
      {/* Win Modal */}
      {isGameWon && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white text-gray-900 p-8 rounded-2xl text-center shadow-2xl">
            <h2 className="text-4xl font-bold mb-4">You Won!</h2>
            <p className="text-lg mb-8">Congratulations on completing the game.</p>
            <button onClick={() => setGameState(dealGame())} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors">
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
