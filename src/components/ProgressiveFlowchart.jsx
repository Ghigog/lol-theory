import React, { useState, useRef, useEffect, useMemo } from 'react';

const DDR = "https://ddragon.leagueoflegends.com";

export default function ProgressiveFlowchart({
  flowchartData,
  setFlowchartData,
  allItems,
  ver,
  setTooltip,
  setTooltipAnchor,
  setMpos,
  tooltip,
  onDragEnd,
  dragging
}) {
  const { nodes, stages } = flowchartData;
  const boardRef = useRef(null);

  // SVG lines state
  const [edges, setEdges] = useState([]);

  const updateEdges = () => {
    if (!boardRef.current) return;
    const newEdges = [];
    const boardRect = boardRef.current.getBoundingClientRect();
    
    Object.values(nodes).forEach(node => {
      const el1 = document.getElementById(`flow-node-${node.id}`);
      if (!el1) return;
      const rect1 = el1.getBoundingClientRect();
      const x1 = rect1.left + rect1.width / 2 - boardRect.left;
      const y1 = rect1.top + rect1.height / 2 - boardRect.top;

      node.nextIds.forEach(nextId => {
        const el2 = document.getElementById(`flow-node-${nextId}`);
        if (!el2) return;
        const rect2 = el2.getBoundingClientRect();
        const x2 = rect2.left + rect2.width / 2 - boardRect.left;
        const y2 = rect2.top + rect2.height / 2 - boardRect.top;
        
        newEdges.push({ id: `${node.id}-${nextId}`, x1, y1, x2, y2 });
      });
    });
    setEdges(newEdges);
  };

  useEffect(() => {
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, [flowchartData, dragging]);

  // After render, we might need a small delay for DOM to settle before drawing lines
  useEffect(() => {
    const timer = setTimeout(updateEdges, 50);
    return () => clearTimeout(timer);
  }, [flowchartData]);


  const updateStage = (stageIdx, key, val) => {
    const nextStages = [...stages];
    nextStages[stageIdx] = { ...nextStages[stageIdx], [key]: val };
    setFlowchartData({ ...flowchartData, stages: nextStages });
  };

  const updateNodeComment = (nodeId, val) => {
    setFlowchartData(prev => ({
      ...prev,
      nodes: {
        ...prev.nodes,
        [nodeId]: { ...prev.nodes[nodeId], comment: val }
      }
    }));
  };

  const removeNode = (nodeId, stageIdx) => {
    if (window.confirm("Are you sure? If this is a required component, it will invalidate the final item save until replaced.")) {
      setFlowchartData(prev => {
        const nextNodes = { ...prev.nodes };
        const node = nextNodes[nodeId];
        
        // Remove from prev and next connections
        node.prevIds.forEach(pId => {
          if (nextNodes[pId]) nextNodes[pId].nextIds = nextNodes[pId].nextIds.filter(id => id !== nodeId);
        });
        node.nextIds.forEach(nId => {
          if (nextNodes[nId]) nextNodes[nId].prevIds = nextNodes[nId].prevIds.filter(id => id !== nodeId);
        });
        
        delete nextNodes[nodeId];

        const nextStages = [...prev.stages];
        nextStages[stageIdx] = {
          ...nextStages[stageIdx],
          nodeIds: nextStages[stageIdx].nodeIds.filter(id => id !== nodeId)
        };
        
        return { nodes: nextNodes, stages: nextStages };
      });
    }
  };

  // Drag and Drop
  const onNodeDragStart = (e, nodeId, stageIdx) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'flow-node', nodeId, srcStageIdx: stageIdx }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const onBoardDragOver = (e) => {
    e.preventDefault();
  };

  const onStageDrop = (e, targetStageIdx) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);

      if (data.type === 'shop-item') {
        // Drop new item from shop
        const itemId = data.itemId;
        const newNodeId = `node_${Date.now()}`;
        
        setFlowchartData(prev => {
          const nextNodes = { ...prev.nodes, [newNodeId]: { id: newNodeId, itemId, comment: "", prevIds: [], nextIds: [] } };
          const nextStages = [...prev.stages];
          nextStages[targetStageIdx] = {
            ...nextStages[targetStageIdx],
            nodeIds: [...nextStages[targetStageIdx].nodeIds, newNodeId]
          };
          return { nodes: nextNodes, stages: nextStages };
        });
      } else if (data.type === 'flow-node') {
        const { nodeId, srcStageIdx } = data;
        if (srcStageIdx === targetStageIdx) return; // Same stage
        
        setFlowchartData(prev => {
          const nextStages = [...prev.stages];
          // Remove from old
          nextStages[srcStageIdx] = {
            ...nextStages[srcStageIdx],
            nodeIds: nextStages[srcStageIdx].nodeIds.filter(id => id !== nodeId)
          };
          // Add to new
          nextStages[targetStageIdx] = {
            ...nextStages[targetStageIdx],
            nodeIds: [...nextStages[targetStageIdx].nodeIds, nodeId]
          };
          return { ...prev, stages: nextStages };
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addStageBetween = (idx) => {
    setFlowchartData(prev => {
      const nextStages = [...prev.stages];
      nextStages.splice(idx, 0, {
        id: `stage_${Date.now()}`,
        title: `Stage ${nextStages.length + 1}`,
        level: 1, time: "0:00", gold: 0,
        nodeIds: []
      });
      return { ...prev, stages: nextStages };
    });
  };

  // Connecting nodes logic
  const [connectingFrom, setConnectingFrom] = useState(null);

  const startConnection = (e, nodeId) => {
    e.stopPropagation();
    setConnectingFrom(nodeId);
  };

  const completeConnection = (nodeId) => {
    if (!connectingFrom || connectingFrom === nodeId) {
      setConnectingFrom(null);
      return;
    }
    setFlowchartData(prev => {
      const nextNodes = { ...prev.nodes };
      // connectingFrom builds into nodeId
      if (!nextNodes[connectingFrom].nextIds.includes(nodeId)) {
        nextNodes[connectingFrom].nextIds.push(nodeId);
      }
      if (!nextNodes[nodeId].prevIds.includes(connectingFrom)) {
        nextNodes[nodeId].prevIds.push(connectingFrom);
      }
      return { ...prev, nodes: nextNodes };
    });
    setConnectingFrom(null);
  };

  const cancelConnection = () => {
    setConnectingFrom(null);
  };

  useEffect(() => {
    if (connectingFrom) {
      document.addEventListener('click', cancelConnection);
      return () => document.removeEventListener('click', cancelConnection);
    }
  }, [connectingFrom]);

  return (
    <div className="flowchart-container">
      <div className="flowchart-board" ref={boardRef} onDragOver={onBoardDragOver}>
        <svg className="flowchart-edges">
          {edges.map(edge => (
            <line 
              key={edge.id}
              x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2}
              stroke="var(--c-gold)"
              strokeWidth="2"
              strokeDasharray="4"
              opacity="0.6"
            />
          ))}
        </svg>

        <div className="flowchart-stages">
          {stages.map((stage, sIdx) => (
            <React.Fragment key={stage.id}>
              {sIdx > 0 && (
                <div className="stage-divider" onClick={() => addStageBetween(sIdx)}>
                  <div className="stage-divider-btn">+</div>
                </div>
              )}
              
              <div 
                className="flow-stage" 
                onDrop={e => onStageDrop(e, sIdx)}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                onDragLeave={e => { e.currentTarget.classList.remove('drag-over'); }}
              >
                <div className="stage-header">
                  <input className="stage-title-input" value={stage.title} onChange={e => updateStage(sIdx, 'title', e.target.value)} />
                  <div className="stage-metrics">
                    <div className="metric">
                      <span className="metric-icon">Lv</span>
                      <input type="number" min="1" max="18" value={stage.level} onChange={e => updateStage(sIdx, 'level', e.target.value)} />
                    </div>
                    <div className="metric">
                      <span className="metric-icon">⏱</span>
                      <input type="text" value={stage.time} onChange={e => updateStage(sIdx, 'time', e.target.value)} placeholder="0:00" />
                    </div>
                    <div className="metric">
                      <span className="metric-icon">💰</span>
                      <input type="number" value={stage.gold} onChange={e => updateStage(sIdx, 'gold', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="stage-nodes">
                  {stage.nodeIds.map(nodeId => {
                    const node = nodes[nodeId];
                    if (!node) return null;
                    const item = allItems[node.itemId];
                    if (!item) return null;

                    return (
                      <div 
                        key={nodeId} 
                        id={`flow-node-${nodeId}`}
                        className={`flow-node ${connectingFrom === nodeId ? 'connecting-src' : ''} ${connectingFrom && connectingFrom !== nodeId ? 'connecting-target' : ''}`}
                        draggable
                        onDragStart={e => onNodeDragStart(e, nodeId, sIdx)}
                        onDragEnd={onDragEnd}
                        onClick={e => {
                          e.stopPropagation();
                          if (connectingFrom) completeConnection(nodeId);
                        }}
                      >
                        <div className="node-item">
                          <img 
                            src={`${DDR}/cdn/${ver}/img/item/${item.image.full}`} 
                            alt={item.name} 
                            onMouseEnter={e => { setTooltip(item); setMpos({ x:e.clientX, y:e.clientY }); setTooltipAnchor(e.currentTarget); }}
                            onMouseLeave={() => { setTooltip(null); setTooltipAnchor(null); }}
                          />
                          <div className="node-rm" onClick={(e) => { e.stopPropagation(); removeNode(nodeId, sIdx); }}>✕</div>
                          <div className="node-connect-btn" onClick={e => startConnection(e, nodeId)} title="Drag line to next item">+</div>
                        </div>
                        <input 
                          className="node-comment" 
                          placeholder="Add note..." 
                          value={node.comment} 
                          onChange={e => updateNodeComment(nodeId, e.target.value)} 
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    );
                  })}
                  {stage.nodeIds.length === 0 && (
                    <div className="empty-stage-hint">Drop items here</div>
                  )}
                </div>
              </div>
            </React.Fragment>
          ))}
          {stages.length > 0 && (
            <div className="stage-divider" onClick={() => addStageBetween(stages.length)}>
              <div className="stage-divider-btn">+</div>
            </div>
          )}
          {stages.length === 0 && (
            <div className="empty-flowchart-hint">Toggle to inventory to add items, or drop items from shop here.</div>
          )}
        </div>
      </div>
    </div>
  );
}
