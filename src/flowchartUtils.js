export function generateFlowchartFromEquipped(equippedIds, allItems) {
  let nodes = {};
  let stages = [];
  let nextNodeId = 1;
  const generateId = () => `node_${nextNodeId++}`;

  let currentStageIndex = 0;

  function getDepth(itemId) {
    const item = allItems[itemId];
    if (!item || !item.from || item.from.length === 0) return 1;
    return 1 + Math.max(...item.from.map(getDepth));
  }

  equippedIds.forEach(eqId => {
    if (!eqId) return;
    const depth = getDepth(eqId);
    
    // Ensure we have enough stages
    while (stages.length < currentStageIndex + depth) {
      stages.push({
        id: `stage_${stages.length + 1}`,
        title: `Stage ${stages.length + 1}`,
        level: 1, time: "0:00", gold: 0,
        nodeIds: []
      });
    }

    // Traverse and build nodes
    function buildNode(itemId, depthOffset) {
      const item = allItems[itemId];
      if (!item) return null;

      const node = {
        id: generateId(),
        itemId: itemId,
        comment: "",
        prevIds: [],
        nextIds: []
      };
      
      nodes[node.id] = node;

      const stageIndex = currentStageIndex + depthOffset - 1;
      
      if (item.from && item.from.length > 0) {
        item.from.forEach(childId => {
          const childNode = buildNode(childId, getDepth(childId));
          if (childNode) {
            childNode.nextIds.push(node.id);
            node.prevIds.push(childNode.id);
          }
        });
      }
      
      stages[stageIndex].nodeIds.push(node.id);
      return node;
    }

    buildNode(eqId, depth);
    currentStageIndex += depth;
  });

  return { nodes, stages };
}

// Function to check if the flowchart still correctly builds the target final items
export function validateFlowchart(flowchartData, equippedIds, allItems) {
  // A flowchart is valid if for every equipped item, we can find a matching subgraph
  // This might be tricky if the user has multiple of the same item.
  // For now, let's just do a basic check:
  // Are all required final items present in the flowchart?
  // And do they have their required components?
  
  // This is a complex check. Let's start with a simpler one:
  // We just find nodes corresponding to equippedIds, and verify their tree down to leaves
  // matches the Data Dragon item.from logic.
  // Actually, the user requirement: "If an item is missing to complete the final build, a small error notification should appear that prevents the player from saving the build."
  // We can just verify that all equipped final items exist, and their required components are connected.
  
  const { nodes, stages } = flowchartData;
  const missing = [];
  
  // Create a pool of available nodes in the flowchart
  let availableNodes = { ...nodes };

  function verifySubtree(itemId, targetNodeId) {
    if (!targetNodeId) return false;
    const node = availableNodes[targetNodeId];
    if (!node || node.itemId !== itemId) return false;
    
    // Consume this node
    delete availableNodes[targetNodeId];

    const item = allItems[itemId];
    if (item && item.from && item.from.length > 0) {
      let valid = true;
      // We need to find children in prevIds that match item.from
      let remainingPrevIds = [...node.prevIds];
      
      for (const requiredChildId of item.from) {
        // Find a matching child in prevIds
        const matchIndex = remainingPrevIds.findIndex(prevId => availableNodes[prevId] && availableNodes[prevId].itemId === requiredChildId);
        
        if (matchIndex >= 0) {
          const childId = remainingPrevIds[matchIndex];
          remainingPrevIds.splice(matchIndex, 1);
          if (!verifySubtree(requiredChildId, childId)) {
            valid = false;
          }
        } else {
          valid = false;
        }
      }
      return valid;
    }
    return true;
  }

  for (const eqId of equippedIds) {
    if (!eqId) continue;
    // Find a root node that matches eqId and hasn't been consumed
    const rootNodeId = Object.keys(availableNodes).find(nid => availableNodes[nid].itemId === eqId);
    
    if (rootNodeId) {
      if (!verifySubtree(eqId, rootNodeId)) {
        missing.push(allItems[eqId]?.name || eqId);
      }
    } else {
      missing.push(allItems[eqId]?.name || eqId);
    }
  }

  return missing;
}
